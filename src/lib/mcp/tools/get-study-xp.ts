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
  name: "get_study_xp",
  title: "Get study XP",
  description:
    "The signed-in learner's XP: the all-time total and the XP earned on each study day over the last few days (days with no study are left out).",
  inputSchema: {
    days: z.number().int().min(1).max(90).optional().describe("How many recent days to include. Defaults to 7."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const db = clientFor(ctx);
    const since = new Date(Date.now() - (days ?? 7) * 86400e3).toISOString().slice(0, 10);
    const [total, daily] = await Promise.all([
      db.from("user_progress").select("xp").maybeSingle(),
      db.from("user_study_days").select("day, xp").gte("day", since).order("day", { ascending: true }),
    ]);
    const error = total.error ?? daily.error;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const result = { total_xp: total.data?.xp ?? 0, days: daily.data ?? [] };
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
  },
});
