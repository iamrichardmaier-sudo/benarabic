import { DOMParser, type Element } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STRIP_TAGS = ["script", "style", "nav", "header", "footer", "aside", "noscript", "iframe", "form", "figure"];

// A stateless read-it-and-render proxy for the user's own personal reading
// session -- fetches one article the user asked for, extracts its text, and
// returns it. Nothing here is stored: no caching, no article history, no
// database write. Structurally the same thing a browser's reader mode or a
// translation extension does.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (typeof url !== "string" || !url.trim()) {
      return new Response(JSON.stringify({ error: "A URL is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: "That doesn't look like a valid URL." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return new Response(JSON.stringify({ error: "Only http/https links are supported." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(parsed.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "ar,en;q=0.8",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `The site returned an error (${res.status}). It may be blocking automated requests.` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const html = await res.text();

    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) {
      return new Response(JSON.stringify({ error: "Could not parse that page." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const tag of STRIP_TAGS) {
      doc.querySelectorAll(tag).forEach((el) => (el as Element).remove());
    }

    const title =
      doc.querySelector("h1")?.textContent?.trim() ||
      doc.querySelector("title")?.textContent?.trim() ||
      "";

    const paragraphsFrom = (root: Element): string[] =>
      Array.from(root.querySelectorAll("p"))
        .map((p) => (p as Element).textContent?.trim() ?? "")
        .filter((t) => t.length > 0);

    // Most news sites mark up the article body semantically -- prefer that.
    // Otherwise, fall back to whichever element holds the most <p> text
    // body-wide (a simplified version of what "reader mode" tools do), since
    // page layouts vary too much to hardcode selectors per site.
    let paragraphs: string[] = [];
    const article = doc.querySelector("article");
    if (article) paragraphs = paragraphsFrom(article as Element);

    if (paragraphs.length === 0) {
      const allParagraphs = Array.from(doc.querySelectorAll("p")) as Element[];
      const scoreByParent = new Map<Element, number>();
      const parentOf = new Map<Element, Element>();
      for (const p of allParagraphs) {
        const parent = p.parentElement as Element | null;
        if (!parent) continue;
        const text = p.textContent?.trim() ?? "";
        scoreByParent.set(parent, (scoreByParent.get(parent) ?? 0) + text.length);
        parentOf.set(p, parent);
      }
      let bestParent: Element | null = null;
      let bestScore = 0;
      for (const [parent, score] of scoreByParent) {
        if (score > bestScore) {
          bestScore = score;
          bestParent = parent;
        }
      }
      if (bestParent) paragraphs = paragraphsFrom(bestParent);
    }

    if (paragraphs.length === 0) {
      return new Response(
        JSON.stringify({ error: "Could not find article text on that page. Try pasting it in directly instead." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const content = paragraphs.join("\n\n");
    return new Response(JSON.stringify({ title, content, sourceUrl: parsed.toString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-article error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
