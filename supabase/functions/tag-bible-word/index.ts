import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TagResult {
  surface: string;
  root: string | null;
  lemma: string;
  pos: "verb" | "noun" | "adjective" | "participle" | "proper_noun" | "particle" | "other";
  verbForm: string | null;
  gloss: string;
}

// Input words are raw inflected surface forms exactly as they appear in the
// Van Dyke Arabic Bible -- still carrying attached clitics (و, ف, ب, ل, ك,
// the definite article, pronoun suffixes) that a clean flashcard word never
// would. The model has to see past those to the content word underneath.
const SYSTEM_PROMPT = `You are an expert in Classical and Modern Standard Arabic morphology and lexicography, reading the Smith & Van Dyke Arabic Bible (1865), a fully-voweled Arabic text.

For each word you are given, exactly as it appears in the verse -- which may still carry attached prefixes (و "and", ف "so/then", ب "with/by", ل "to/for", ك "like/as", the definite article ال) and suffixes (attached pronouns, plural/dual endings) -- identify the underlying CONTENT word and return:
- surface: echo the input word back exactly as given.
- root: the triliteral/quadriliteral root of the content word, letters joined by "-" (e.g. "ك-ت-ب"), or "" if it has no derivable root (particles, proper nouns, borrowed words).
- lemma: the dictionary/citation form of the content word, fully voweled with harakat (tashkeel) -- for a verb, the 3rd-person-masculine-singular past tense; for a noun/adjective, the singular indefinite form.
- pos: one of "verb", "noun", "adjective", "participle", "proper_noun", "particle", "other". Use "proper_noun" for personal names and place names. Use "particle" for prepositions, conjunctions, and other function words when the word itself IS that particle (not merely carrying one as a prefix).
- verbForm: the Form as a Roman numeral "I".."X" if the content word is a verb, else "".
- gloss: a short (2-6 word) English definition of the word as it is most commonly used in this text. For a proper noun, give the name in English (e.g. "Peter", "Galilee").

Return exactly one result per input word, in the same order, with the "surface" field matching the input exactly.`;

const RESULT_JSON_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          surface: { type: "string" },
          root: { type: "string" },
          lemma: { type: "string" },
          pos: {
            type: "string",
            enum: ["verb", "noun", "adjective", "participle", "proper_noun", "particle", "other"],
          },
          verbForm: { type: "string" },
          gloss: { type: "string" },
        },
        required: ["surface", "root", "lemma", "pos", "verbForm", "gloss"],
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
    const { words } = (await req.json()) as { words: string[] };

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
        system: SYSTEM_PROMPT,
        output_config: {
          format: { type: "json_schema", schema: RESULT_JSON_SCHEMA },
        },
        messages: [{ role: "user", content: JSON.stringify(words) }],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
      console.error("tag-bible-word: failed to parse model output:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const nullify = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
    const rawResults = (parsed.results ?? []) as Record<string, unknown>[];

    // Match by position, not by re-comparing the model's echoed "surface"
    // string against the input: Arabic diacritics admit more than one valid
    // Unicode encoding of the same visible word (e.g. precomposed alef-madda
    // vs. alef + a combining madda), and a model reply can round-trip through
    // a different one than the source text used -- an exact string compare
    // then silently drops words that tagged just fine. The prompt asks for
    // one result per input in order, so pairing by index is both simpler and
    // immune to that whole class of mismatch; the surface we return is always
    // the original input, never the model's copy of it.
    const results: TagResult[] = words
      .map((surface, i) => {
        const r = rawResults[i];
        if (!r || typeof r !== "object") return null;
        return {
          surface,
          root: nullify(r.root),
          lemma: (r.lemma as string) || surface,
          pos: ((r.pos as string) || "other") as TagResult["pos"],
          verbForm: nullify(r.verbForm),
          gloss: (r.gloss as string) || "",
        };
      })
      .filter((r): r is TagResult => r !== null);

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("tag-bible-word error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
