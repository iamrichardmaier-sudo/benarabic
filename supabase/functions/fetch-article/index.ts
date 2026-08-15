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

    // Most news sites mark up the article body semantically -- prefer that,
    // but only when it actually yielded a body's worth of text. Some sites use
    // <article> as a card wrapper in a feed, so a one-paragraph result means we
    // grabbed the wrong element and should fall through to scoring.
    let paragraphs: string[] = [];
    const article = doc.querySelector("article");
    if (article) {
      const fromArticle = paragraphsFrom(article as Element);
      if (fromArticle.length >= 2) paragraphs = fromArticle;
    }

    if (paragraphs.length === 0) {
      // Score ANCESTORS, not just immediate parents. Most modern news sites
      // wrap every <p> in its own <div>, so scoring by immediate parent gives
      // each candidate exactly one paragraph and the "winner" is a single
      // arbitrary paragraph -- which is the one-paragraph bug this fixes.
      // Walking several levels up lets the true article container accumulate
      // the sum of all its paragraphs and win outright.
      const MAX_DEPTH = 8;
      const MIN_PARAGRAPH_CHARS = 25;

      const textScore = new Map<Element, number>();
      const paraCount = new Map<Element, number>();

      for (const node of Array.from(doc.querySelectorAll("p")) as Element[]) {
        const text = node.textContent?.trim() ?? "";
        if (text.length < MIN_PARAGRAPH_CHARS) continue; // skip captions/bylines
        let ancestor: Element | null = node.parentElement as Element | null;
        for (let depth = 0; ancestor && depth < MAX_DEPTH; depth++) {
          const tag = ancestor.tagName?.toLowerCase();
          if (tag === "body" || tag === "html") break;
          textScore.set(ancestor, (textScore.get(ancestor) ?? 0) + text.length);
          paraCount.set(ancestor, (paraCount.get(ancestor) ?? 0) + 1);
          ancestor = ancestor.parentElement as Element | null;
        }
      }

      // Prefer the DEEPEST element that still holds essentially all the text.
      // Every ancestor above the real container inherits the same score, so
      // taking the highest score alone would climb to a near-body wrapper and
      // drag in navigation and related-article links.
      let best: Element | null = null;
      let bestScore = 0;
      for (const [el, score] of textScore) {
        if (score > bestScore) {
          bestScore = score;
          best = el;
        }
      }
      if (best && bestScore > 0) {
        const threshold = bestScore * 0.9;
        let deepest = best;
        let deepestDepth = -1;
        for (const [el, score] of textScore) {
          if (score < threshold) continue;
          // Never descend to a container holding a single paragraph -- that is
          // exactly the failure mode being fixed here.
          if ((paraCount.get(el) ?? 0) < 2 && (paraCount.get(best) ?? 0) >= 2) continue;
          let depth = 0;
          let walk: Element | null = el.parentElement as Element | null;
          while (walk && depth < 64) {
            depth++;
            walk = walk.parentElement as Element | null;
          }
          if (depth > deepestDepth) {
            deepestDepth = depth;
            deepest = el;
          }
        }
        paragraphs = paragraphsFrom(deepest);
      }
    }

    // De-duplicate while preserving order; nested containers can otherwise
    // yield the same paragraph twice.
    const seen = new Set<string>();
    paragraphs = paragraphs.filter((t) => {
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    });

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
