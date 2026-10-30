/**
 * translation-practice: three hard English sentences a day to translate into
 * Arabic, and AI feedback on each attempt.
 *
 * POST {"action": "today", "day": "yyyy-mm-dd"}
 *   The learner's three sentences for that day, written the first time they
 *   are asked for from the learner's newest words and recent mistakes, then
 *   kept, so the day's set never changes under them. Also returns the
 *   learner's attempts at them so far.
 *
 * POST {"action": "grade", "challengeId": "...", "attempt": "..."}
 *   Grades one attempt (see practice.ts for how wrong corrections are kept
 *   out), saves it, and returns it.
 *
 * Runs on Google's Gemini API (GEMINI_API_KEY; a free-tier key from Google AI
 * Studio is plenty for three sentences a day). GEMINI_MODEL overrides the
 * model. Everything is read and written with the learner's own sign-in, so
 * row-level security keeps each learner to their own rows.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  applyVerification, buildChallengePrompt, buildGradePrompt, buildVerifyPrompt,
  CHALLENGE_SCHEMA, CHALLENGE_SYSTEM, closestReference, exactMatchFeedback,
  GRADE_SCHEMA, GRADE_SYSTEM, isCorrection, parseChallenges, parseGrade,
  VERIFY_SCHEMA, VERIFY_SYSTEM, weakSpots, type Challenge, type Feedback, type RecentWord,
} from "./practice.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Google's alias for its current Flash model, so a retired version never breaks the function. */
const MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-flash-latest";
const MAX_ATTEMPT_LENGTH = 600;

class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** One Gemini call that must answer as JSON in `schema`. */
async function gemini(system: string, prompt: string, schema: unknown, temperature: number): Promise<unknown> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new HttpError("GEMINI_API_KEY is not set", 500);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature, responseMimeType: "application/json", responseSchema: schema },
      }),
    },
  );
  if (!res.ok) {
    const detail = await res.text();
    console.error("Gemini error:", res.status, detail);
    if (res.status === 429) throw new HttpError("Gemini's free limit is used up for now — try again in a minute.", 429);
    throw new HttpError("The AI service could not be reached.", 502);
  }
  const data = await res.json();
  const out = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  try {
    return JSON.parse(out);
  } catch {
    console.error("Gemini gave unreadable JSON:", out.slice(0, 500));
    throw new HttpError("The AI gave an unreadable answer — try again.", 502);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: auth } = await db.auth.getUser();
  const user = auth?.user;
  if (!user) return json({ error: "Sign in first" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    action?: string; day?: string; challengeId?: string; attempt?: string;
  };

  try {
    if (body.action === "today") {
      if (!body.day || !/^\d{4}-\d{2}-\d{2}$/.test(body.day)) return json({ error: "day must be yyyy-mm-dd" }, 400);
      return json(await today(db, user.id, body.day));
    }
    if (body.action === "grade") {
      const attempt = (body.attempt ?? "").trim();
      if (!body.challengeId || !attempt) return json({ error: "challengeId and attempt are required" }, 400);
      if (attempt.length > MAX_ATTEMPT_LENGTH) return json({ error: "That attempt is too long" }, 400);
      return json(await grade(db, user.id, body.challengeId, attempt));
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error("translation-practice error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

type Db = ReturnType<typeof createClient>;

const CHALLENGE_COLUMNS = "id, day, position, english, grammar_focus, target_words, reference_translations, pitfalls";

async function today(db: Db, userId: string, day: string) {
  const existing = await challengesFor(db, day);
  const challenges = existing.length === 3 ? existing : await writeDay(db, userId, day);
  const { data: attempts, error } = await db
    .from("translation_attempts")
    .select("id, challenge_id, attempt, feedback, flagged, created_at")
    .in("challenge_id", challenges.map((c) => c.id))
    .order("created_at");
  if (error) throw error;
  return { challenges, attempts: attempts ?? [] };
}

async function challengesFor(db: Db, day: string) {
  const { data, error } = await db
    .from("translation_challenges")
    .select(CHALLENGE_COLUMNS)
    .eq("day", day)
    .order("position");
  if (error) throw error;
  return (data ?? []) as (Challenge & { id: string })[];
}

async function writeDay(db: Db, userId: string, day: string) {
  const { data: cards, error: cardsError } = await db
    .from("flashcards")
    .select("word, english, word_type")
    .order("created_at", { ascending: false })
    .limit(40);
  if (cardsError) throw cardsError;

  const { data: past, error: pastError } = await db
    .from("translation_attempts")
    .select("feedback")
    .eq("flagged", false)
    .order("created_at", { ascending: false })
    .limit(30);
  if (pastError) throw pastError;

  const generated = parseChallenges(await gemini(
    CHALLENGE_SYSTEM,
    buildChallengePrompt((cards ?? []) as RecentWord[], weakSpots((past ?? []).map((p) => p.feedback as Feedback))),
    CHALLENGE_SCHEMA,
    0.9,
  ));

  // Two tabs asking at once both write; the unique (user, day, position)
  // keeps whichever landed first, and both then read back the same set.
  const { error } = await db.from("translation_challenges").upsert(
    generated.map((c, i) => ({ ...c, user_id: userId, day, position: i + 1 })),
    { onConflict: "user_id,day,position", ignoreDuplicates: true },
  );
  if (error) throw error;
  return challengesFor(db, day);
}

async function grade(db: Db, userId: string, challengeId: string, attempt: string) {
  const { data: challenge, error } = await db
    .from("translation_challenges")
    .select(CHALLENGE_COLUMNS)
    .eq("id", challengeId)
    .maybeSingle();
  if (error) throw error;
  if (!challenge) throw new HttpError("No such sentence", 404);
  const c = challenge as Challenge & { id: string };

  let feedback = exactMatchFeedback(attempt, c.reference_translations);
  if (!feedback) {
    const nearest = closestReference(attempt, c.reference_translations);
    feedback = parseGrade(
      await gemini(GRADE_SYSTEM, buildGradePrompt(c, attempt, nearest), GRADE_SCHEMA, 0.2),
      nearest,
    );
    if (feedback.words.some((w) => isCorrection(w.status))) {
      try {
        feedback = applyVerification(
          feedback,
          await gemini(VERIFY_SYSTEM, buildVerifyPrompt(c.english, attempt, feedback), VERIFY_SCHEMA, 0),
        );
      } catch (e) {
        // The grade still stands; the app says it was not double-checked.
        console.error("verification failed:", e);
      }
    } else {
      feedback = { ...feedback, verified: true };
    }
  }

  const { data: saved, error: saveError } = await db
    .from("translation_attempts")
    .insert({ user_id: userId, challenge_id: c.id, attempt, feedback })
    .select("id, challenge_id, attempt, feedback, flagged, created_at")
    .single();
  if (saveError) throw saveError;
  return saved;
}
