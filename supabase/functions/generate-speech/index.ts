import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

serve(async (req) => {
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

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
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
          text,
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
    //
    // A plain Uint8Array body, not the raw ArrayBuffer: the edge runtime
    // threw on an ArrayBuffer response body with no error this function's
    // own try/catch ever saw -- just a bare EDGE_FUNCTION_ERROR at the
    // platform level. A byte array is the least ambiguous BodyInit there is.
    const audio = new Uint8Array(await response.arrayBuffer());
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
