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
  name: "create_flashcard",
  title: "Create flashcard",
  description: "Create a new Arabic flashcard for the signed-in user with an Arabic word and its English translation.",
  inputSchema: {
    word: z.string().trim().min(1).describe("The Arabic word."),
    english: z.string().trim().min(1).describe("The English translation."),
    image_url: z.string().url().optional().describe("Optional image URL to display with the card."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ word, english, image_url }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await clientFor(ctx)
      .from("flashcards")
      .insert({
        user_id: ctx.getUserId(),
        word,
        english,
        image_url: image_url ?? null,
        next_review_date: today,
        interval_days: 0,
        ease_factor: 2.5,
        learning_stage: "new",
        stage1_attempts: 0,
        stage2_attempts: 0,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Created card ${data.id}: ${data.word} — ${data.english}` }],
      structuredContent: { card: data },
    };
  },
});
