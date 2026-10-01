// Deno.serve, not the deno.land/std serve() the project's older functions use:
// every call through the old import failed with a bare, message-less
// EDGE_FUNCTION_ERROR at the platform level -- before this function's own
// try/catch ever ran, going by the total absence of its console.error output
// even in the logs of other functions on this same project that do log
// cleanly. Deno.serve is the runtime's own native server and what Supabase's
// own function template uses today.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Same voices the II Chapter 1 podcast used, so a card sounds like the rest
// of the app rather than introducing a third voice.
const VOICE_IDS: Record<string, string> = {
  ar: "KSvfz6YR8FFb1D1QRvhO", // Maroun -- Standard Arabic Narration
  en: "onwK4e9ZLuTAKqWW03F9", // Daniel -- Steady Broadcaster
};

const BUCKET = "word-audio";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

/** sha256 hex of `${voice}\0${text}` -- the cache key and the storage filename. */
async function textKeyFor(voice: string, text: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${voice}\0${text}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Every word is spoken once and cached forever after -- the first person to
 * listen to a word pays for it, everyone (and every listen) after that gets
 * it for free and instantly, no ElevenLabs call at all. A caching failure
 * (lookup, upload, or the bookkeeping insert) never fails the request: it
 * just falls back to generating fresh, same as before this existed.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, voice } = await req.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return new Response(
        JSON.stringify({ error: "text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const voiceId = VOICE_IDS[voice];
    if (!voiceId) {
      return new Response(
        JSON.stringify({ error: `voice must be one of: ${Object.keys(VOICE_IDS).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const trimmed = text.trim();
    const textKey = await textKeyFor(voice, trimmed);

    try {
      const { data: cached } = await supabase
        .from("word_audio")
        .select("audio_url")
        .eq("text_key", textKey)
        .maybeSingle();
      if (cached?.audio_url) {
        const hit = await fetch(cached.audio_url);
        if (hit.ok) {
          const bytes = new Uint8Array(await hit.arrayBuffer());
          return new Response(bytes, {
            headers: { ...corsHeaders, "Content-Type": "application/octet-stream" },
          });
        }
        console.error("Cached audio_url did not fetch cleanly, regenerating:", cached.audio_url);
      }
    } catch (cacheErr) {
      console.error("word_audio cache lookup failed, generating fresh:", cacheErr);
    }

    // The secret is stored as ELEVEN_LABS_API in this project; the more
    // conventional name is accepted too, so a future rename either way
    // keeps working without another deploy.
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVEN_LABS_API") ?? Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Speech service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: trimmed,
          model_id: "eleven_multilingual_v2",
        }),
      },
    );

    if (!response.ok) {
      const t = await response.text();
      console.error("ElevenLabs error:", response.status, t);
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: "Speech service rejected the API key" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Speech service rate limit reached. Try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "Failed to generate speech" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // application/octet-stream, not audio/mpeg: supabase-js's functions.invoke
    // only hands the caller a Blob for a Content-Type it special-cases, and
    // audio/mpeg is not one of them -- anything else is read back as text,
    // which corrupts binary audio. octet-stream is what the client expects.
    const audio = new Uint8Array(await response.arrayBuffer());

    try {
      const path = `${textKey}.mp3`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, audio, { contentType: "audio/mpeg", upsert: true });
      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const { error: insertError } = await supabase
        .from("word_audio")
        .upsert(
          { text_key: textKey, voice, source_text: trimmed, audio_url: pub.publicUrl },
          { onConflict: "text_key" },
        );
      if (insertError) throw insertError;
    } catch (cacheWriteErr) {
      // Caching is a bonus, not a requirement: the listener still gets their
      // audio even if it never got cached, just at full price next time.
      console.error("Could not cache generated audio:", cacheWriteErr);
    }

    return new Response(audio, {
      headers: { ...corsHeaders, "Content-Type": "application/octet-stream" },
    });
  } catch (e) {
    console.error("generate-speech error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
