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
  name: "list_flashcards",
  title: "List flashcards",
  description: "List the signed-in user's Arabic flashcards. Optionally filter by a substring match on the Arabic word or English translation.",
  inputSchema: {
    search: z.string().optional().describe("Optional case-insensitive substring to match against the Arabic word or English translation."),
    limit: z.number().int().min(1).max(500).optional().describe("Maximum number of cards to return. Defaults to 100."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = clientFor(ctx)
      .from("flashcards")
      .select("id, word, english, next_review_date, interval_days, ease_factor, learning_stage, word_type, verb_form, root")
      .order("created_at", { ascending: false })
      .limit(limit ?? 100);
    if (search && search.trim()) {
      const s = search.trim().replace(/[%,]/g, "");
      q = q.or(`word.ilike.%${s}%,english.ilike.%${s}%`);
    }
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { cards: data ?? [] },
    };
  },
});
