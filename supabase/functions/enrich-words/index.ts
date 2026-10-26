/**
 * enrich-words: builds out every saved word in the database.
 *
 * Each run takes a small batch of words not yet enriched — from learners'
 * flashcards and from the shared deck vocabulary, one model call per distinct
 * spelling — and adds a Fusha example sentence, a Shaami sentence built on the
 * word's Levantine equivalent, the common words sharing its root, and any
 * missing details (meaning, vowels, root, verb forms, gender, plurals, Shaami
 * equivalent). Nothing already stored is overwritten.
 *
 * One call is enough to do the whole database: when words remain, the
 * function calls itself again in the background, batch after batch, until
 * none are left. POST {"status": true} only reports how many remain.
 *
 * It runs across every learner's rows, so it does not take a user sign-in. It
 * takes ENRICH_SECRET (a function secret) in an x-enrich-secret header, or
 * the project's service role key as a bearer token.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import {
  buildInput, matchResults, RESULT_SCHEMA, SYSTEM_PROMPT, type PendingWord,
} from "./enrich.ts";

const MODEL = "claude-opus-5-5";
/** Words per model call — small enough to finish well inside the function time limit. */
const DEFAULT_BATCH = 6;
/** A ceiling on how many batches one call can chain, as a guard against a runaway loop. */
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
    const { data, error } = await db.rpc("pending_word_enrichment_count");
    if (error) throw error;
    return Number(data ?? 0);
  };

  try {
    if (body.status) return json({ remaining: await remaining() });

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY is not set" }, 500);

    const batchSize = Math.min(Math.max(Math.floor(body.batchSize ?? DEFAULT_BATCH), 1), 12);
    const { data: pending, error } = await db.rpc("pending_word_enrichment", { p_limit: batchSize });
    if (error) throw error;
    const words = (pending ?? []) as PendingWord[];
    if (words.length === 0) return json({ processed: 0, remaining: 0, done: true });

    const outcomes = await enrich(new Anthropic({ apiKey }), words);

    let enriched = 0;
    let rowsUpdated = 0;
    const failed: { word: string; reason: string }[] = [];
    for (const { word, outcome } of outcomes) {
      if (typeof outcome === "string") {
        failed.push({ word: word.word, reason: outcome });
        const { error: e } = await db.rpc("mark_word_enrichment_failed", { p_word: word.word, p_error: outcome });
        if (e) throw e;
        continue;
      }
      const { data: n, error: e } = await db.rpc("apply_word_enrichment", { p_word: word.word, p: outcome });
      if (e) throw e;
      enriched++;
      rowsUpdated += Number(n ?? 0);
    }

    const left = await remaining();
    const depth = body.depth ?? 0;
    // Keep going in the background while there is work and this batch moved
    // it forward; a batch where every word failed stops the chain.
    const next = body.chain !== false && left > 0 && enriched > 0 && depth < MAX_CHAIN;
    if (next) {
      const call = fetch(`${SUPABASE_URL}/functions/v1/enrich-words`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ batchSize, depth: depth + 1 }),
      }).catch((e) => console.error("enrich-words: could not start the next batch:", e));
      if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(call);
    }

    console.log(`enrich-words: batch ${depth}: ${enriched} enriched, ${failed.length} failed, ${left} left`);
    return json({ processed: words.length, enriched, rowsUpdated, failed, remaining: left, continuing: next });
  } catch (e) {
    console.error("enrich-words error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

/**
 * One model call for the batch. A refusal or an unreadable reply fails every
 * word in it (recorded, so the run moves on) rather than throwing.
 */
async function enrich(client: Anthropic, words: PendingWord[]) {
  const failAll = (reason: string) => words.map((word) => ({ word, outcome: reason }));
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Re-runs a declined request on a fallback model inside the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: RESULT_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildInput(words) }],
    });

    if (response.stop_reason === "refusal") {
      return failAll(`model declined (${response.stop_details?.category ?? "unknown"})`);
    }
    if (response.stop_reason === "max_tokens") return failAll("reply was cut off");
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return failAll("no reply text");
    const parsed = JSON.parse(text.text) as { results?: unknown[] };
    return matchResults(words, Array.isArray(parsed.results) ? parsed.results : []);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError) {
      // Worth retrying later, not worth parking the words: rethrow so they stay pending.
      throw e;
    }
    if (e instanceof SyntaxError) return failAll("reply was not valid JSON");
    throw e;
  }
}
