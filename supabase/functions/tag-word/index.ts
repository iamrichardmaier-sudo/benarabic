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
- root: the triliteral/quadriliteral root, letters joined by "-" (e.g. "ك-ت-ب"), or "" (empty string) if it has no derivable root (e.g. a loanword or particle).
- wordType: one of "verb", "masdar", "noun", "adjective", "participle", "other".
- verbForm: the Form as a Roman numeral "I".."X" if the word is a verb (or is derived from a specific verb form), else "" (empty string).
- wordVoweled: the word fully voweled with harakat (tashkeel), reflecting its most common reading.
- pastTense, presentTense, masdarForm: fully voweled 3rd-person-masculine-singular past, present (indicative), and verbal noun, ONLY if this word is a verb or a form directly tied to one verb (else "" for all three).
- companionForms: an array of the up to 4 MOST COMMON other words sharing the same root (other derived forms, whether other verb forms, participles, or nouns) that a learner would benefit from seeing alongside this word. Each entry has "form" (fully voweled Arabic) and "label" (a short grammatical description, e.g. "Form II verb (past)", "Active participle", "Verbal noun", "Elative/comparative"). Return fewer than 4 if fewer genuinely common forms exist — do not invent rare or contrived forms.

Return exactly one result per input word, in the same order, with matching "id" fields.`;

const RESULT_JSON_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          root: { type: "string" },
          wordType: { type: "string", enum: ["verb", "masdar", "noun", "adjective", "participle", "other"] },
          verbForm: { type: "string" },
          wordVoweled: { type: "string" },
          pastTense: { type: "string" },
          presentTense: { type: "string" },
          masdarForm: { type: "string" },
          companionForms: {
            type: "array",
            items: {
              type: "object",
              properties: {
                form: { type: "string" },
                label: { type: "string" },
              },
              required: ["form", "label"],
              additionalProperties: false,
            },
          },
        },
        required: ["id", "root", "wordType", "verbForm", "wordVoweled", "pastTense", "presentTense", "masdarForm", "companionForms"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
};

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

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
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

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 8000,
        thinking: { type: "adaptive" },
        system: SYSTEM_PROMPT,
        output_config: {
          format: { type: "json_schema", schema: RESULT_JSON_SCHEMA },
        },
        messages: [{ role: "user", content: JSON.stringify(inputList) }],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 401 || response.status === 403) {
        const t = await response.text();
        console.error("Anthropic auth error:", response.status, t);
        return new Response(
          JSON.stringify({ error: "AI service misconfigured (invalid API key)." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("Anthropic API error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Failed to tag words" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const textBlock = (data.content as Array<{ type: string; text?: string }> | undefined)
      ?.find((b) => b.type === "text");

    let parsed: { results?: unknown[] };
    try {
      if (!textBlock?.text) throw new Error("No text content in model response");
      parsed = JSON.parse(textBlock.text);
    } catch (e) {
      console.error("tag-word: failed to parse model output:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const byId = new Map(words.map((w) => [w.id, w]));
    const nullify = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

    const results: TagResult[] = (parsed.results ?? [])
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object" && byId.has((r as Record<string, unknown>).id as string))
      .map((r) => ({
        id: r.id as string,
        root: nullify(r.root),
        wordType: ((r.wordType as string) || "other") as TagResult["wordType"],
        verbForm: nullify(r.verbForm),
        wordVoweled: (r.wordVoweled as string) || byId.get(r.id as string)!.fusha,
        pastTense: nullify(r.pastTense),
        presentTense: nullify(r.presentTense),
        masdarForm: nullify(r.masdarForm),
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
