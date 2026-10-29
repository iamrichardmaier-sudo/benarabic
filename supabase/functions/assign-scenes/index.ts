/**
 * assign-scenes: gives every saved card the little animated scene that best
 * pictures its meaning.
 *
 * Each run sends a batch of cards still without a scene — learners'
 * flashcards and the shared deck words, one entry per distinct word and
 * meaning — to Claude, which picks from the scene catalog in
 * _shared/card-scenes.json, and stores the picks. When cards remain, the
 * function calls itself again in the background until none are left, so one
 * call does the whole database. POST {"status": true} only reports how many
 * remain. A scene already set is never replaced.
 *
 * It runs across every learner's rows, so it takes ENRICH_SECRET in an
 * x-enrich-secret header (the same secret enrich-words uses) or the service
 * role key as a bearer token, not a user sign-in.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { buildInput, matchScenes, RESULT_SCHEMA, SYSTEM_PROMPT, type PendingCard } from "./scenes.ts";

const MODEL = "claude-opus-5-5";
/** Picking a scene is a light judgement, so a batch can be large. */
const DEFAULT_BATCH = 40;
const MAX_CHAIN = 2000;

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ENRICH_SECRET = Deno.env.get("ENRICH_SECRET") ?? "";

function authorized(req: Request): boolean {
  const secret = req.headers.get("x-enrich-secret");
  if (ENRICH_SECRET && secret === ENRICH_SECRET) return true;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(SERVICE_KEY) && bearer === SERVICE_KEY;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!authorized(req)) return json({ error: "Not authorized" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    status?: boolean;
    batchSize?: number;
    chain?: boolean;
    depth?: number;
  };
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const remaining = async () => {
    const { data, error } = await db.rpc("pending_card_scenes_count");
    if (error) throw error;
    return Number(data ?? 0);
  };

  try {
    if (body.status) return json({ remaining: await remaining() });

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY is not set" }, 500);

    const batchSize = Math.min(Math.max(Math.floor(body.batchSize ?? DEFAULT_BATCH), 1), 80);
    const { data, error } = await db.rpc("pending_card_scenes", { p_limit: batchSize });
    if (error) throw error;
    const cards = (data ?? []) as PendingCard[];
    if (cards.length === 0) return json({ processed: 0, remaining: 0, done: true });

    const client = new Anthropic({ apiKey });
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Re-runs a declined request on a fallback model inside the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: RESULT_SCHEMA },
      },
      // The catalog is the same on every call, so it is cached.
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildInput(cards) }],
    });

    if (response.stop_reason === "refusal") {
      return json({ error: `model declined (${response.stop_details?.category ?? "unknown"})` }, 502);
    }
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return json({ error: "no reply text" }, 502);
    const parsed = JSON.parse(text.text) as { results?: unknown[] };
    const picks = matchScenes(cards, Array.isArray(parsed.results) ? parsed.results : []);

    let rowsUpdated = 0;
    for (const { card, scene } of picks) {
      const { data: n, error: e } = await db.rpc("apply_card_scene", {
        p_word: card.word, p_english: card.english, p_scene: scene,
      });
      if (e) throw e;
      rowsUpdated += Number(n ?? 0);
    }

    const left = await remaining();
    const depth = body.depth ?? 0;
    // Keep going while there is work and this batch moved it forward.
    const next = body.chain !== false && left > 0 && picks.length > 0 && depth < MAX_CHAIN;
    if (next) {
      const call = fetch(`${SUPABASE_URL}/functions/v1/assign-scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ batchSize, depth: depth + 1 }),
      }).catch((e) => console.error("assign-scenes: could not start the next batch:", e));
      if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(call);
    }

    console.log(`assign-scenes: batch ${depth}: ${picks.length}/${cards.length} assigned, ${left} left`);
    return json({
      processed: cards.length,
      assigned: picks.length,
      rowsUpdated,
      picks: picks.map((p) => ({ word: p.card.word, english: p.card.english, scene: p.scene })),
      remaining: left,
      continuing: next,
    });
  } catch (e) {
    console.error("assign-scenes error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
