import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function clientFor(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_due_cards",
  title: "Get cards due for review",
  description: "List the flashcards that are due for spaced-repetition review today or earlier for the signed-in user.",
  inputSchema: {
    limit: z.number().int().min(1).max(500).optional().describe("Maximum number of cards to return. Defaults to 100."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await clientFor(ctx)
      .from("flashcards")
      .select("id, word, english, next_review_date, interval_days, ease_factor, learning_stage")
      .lte("next_review_date", today)
      .neq("learning_stage", "new")
      .order("next_review_date", { ascending: true })
      .limit(limit ?? 100);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { cards: data ?? [], count: data?.length ?? 0 },
    };
  },
});
