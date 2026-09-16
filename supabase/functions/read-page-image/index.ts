import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Reads a scanned page and returns what it says.
 *
 * A PDF made from a scanner or a phone camera carries pictures of text and no
 * text at all, so the only way to read it is to look at it. This is used for
 * those pages alone — a page that carries its own text never comes here.
 */
const SYSTEM_PROMPT = `You transcribe scanned pages. Return exactly the words on the page, in reading order, as plain text.

- Keep paragraphs as paragraphs, with a blank line between them.
- Join a word broken across a line break back into one word.
- Leave out running heads, page numbers, and footers that repeat on every page.
- Do not summarise, correct, translate, or comment. Transcribe only.
- If the page is blank or unreadable, return an empty string.

The transcript is going to be read aloud, so it should read as continuous prose rather than as a column of short lines.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image } = (await req.json()) as { image?: string };
    if (!image || !image.startsWith("data:image/")) {
      return new Response(
        JSON.stringify({ error: "an image data URL is required" }),
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

    const comma = image.indexOf(",");
    const mediaType = image.slice(5, image.indexOf(";"));
    const data = image.slice(comma + 1);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data } },
              { type: "text", text: "Transcribe this page." },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Anthropic API error:", response.status, detail);
      const message = response.status === 429
        ? "Rate limit reached. Try again in a moment."
        : "Could not read that page.";
      return new Response(
        JSON.stringify({ error: message }),
        { status: response.status === 429 ? 429 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await response.json();
    const text = (result.content as Array<{ type: string; text?: string }> | undefined)
      ?.filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim() ?? "";

    return new Response(
      JSON.stringify({ text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("read-page-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
