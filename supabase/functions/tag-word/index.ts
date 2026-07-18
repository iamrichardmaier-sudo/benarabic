import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface WordInput {
  id: string;
  fusha: string;
  shaami?: string | null;
}

interface TagResult {
  id: string;
  root: string | null;
  wordType: "verb" | "masdar" | "noun" | "adjective" | "participle" | "other";
  verbForm: string | null;
  wordVoweled: string;
  pastTense: string | null;
  presentTense: string | null;
  masdarForm: string | null;
  companionForms: { form: string; label: string }[];
}

const SYSTEM_PROMPT = `You are an expert in Arabic morphology and lexicography, with knowledge equivalent to the Hans Wehr Dictionary of Modern Written Arabic. For each Modern Standard Arabic (Fusha) word you are given, return:
- root: the triliteral/quadriliteral root, letters joined by "-" (e.g. "ك-ت-ب"), or null if it has no derivable root (e.g. a loanword or particle).
- wordType: one of "verb", "masdar", "noun", "adjective", "participle", "other".
- verbForm: the Form as a Roman numeral "I".."X" if the word is a verb (or is derived from a specific verb form), else null.
- wordVoweled: the word fully voweled with harakat (tashkeel), reflecting its most common reading.
- pastTense, presentTense, masdarForm: fully voweled 3rd-person-masculine-singular past, present (indicative), and verbal noun, ONLY if this word is a verb or a form directly tied to one verb (else null for all three).
- companionForms: an array of the up to 4 MOST COMMON other words sharing the same root (other derived forms, whether other verb forms, participles, or nouns) that a learner would benefit from seeing alongside this word. Each entry has "form" (fully voweled Arabic) and "label" (a short grammatical description, e.g. "Form II verb (past)", "Active participle", "Verbal noun", "Elative/comparative"). Return fewer than 4 if fewer genuinely common forms exist — do not invent rare or contrived forms.

Respond with ONLY a JSON array (no prose, no markdown code fences), one object per input word, each shaped exactly as:
{"id": "<same id as input>", "root": string|null, "wordType": string, "verbForm": string|null, "wordVoweled": string, "pastTense": string|null, "presentTense": string|null, "masdarForm": string|null, "companionForms": [{"form": string, "label": string}]}`;

function extractJsonArray(text: string): unknown[] {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON array found in model response");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { words } = (await req.json()) as { words: WordInput[] };

    if (!words || !Array.isArray(words) || words.length === 0) {
      return new Response(
        JSON.stringify({ error: "words array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const inputList = words.map((w) => ({
      id: w.id,
      word: w.fusha,
      ...(w.shaami ? { shaamiNote: w.shaami } : {}),
    }));

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(inputList) },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Failed to tag words" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let parsed: unknown[];
    try {
      parsed = extractJsonArray(content);
    } catch (e) {
      console.error("tag-word: failed to parse model output:", content);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const byId = new Map(words.map((w) => [w.id, w]));
    const results: TagResult[] = parsed
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object" && byId.has((r as Record<string, unknown>).id as string))
      .map((r) => ({
        id: r.id as string,
        root: (r.root as string) ?? null,
        wordType: ((r.wordType as string) ?? "other") as TagResult["wordType"],
        verbForm: (r.verbForm as string) ?? null,
        wordVoweled: (r.wordVoweled as string) ?? byId.get(r.id as string)!.fusha,
        pastTense: (r.pastTense as string) ?? null,
        presentTense: (r.presentTense as string) ?? null,
        masdarForm: (r.masdarForm as string) ?? null,
        companionForms: Array.isArray(r.companionForms) ? (r.companionForms as TagResult["companionForms"]).slice(0, 4) : [],
      }));

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("tag-word error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
