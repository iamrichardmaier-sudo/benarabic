/**
 * Checks every generated page before anything is written. Returns a list of
 * problems; the generator fails the build if there are any.
 */

export function validate(pages, { site, extraPaths = [] }) {
  const errors = [];
  const paths = new Set([...pages.map((p) => p.path), ...extraPaths]);
  const titles = new Map();
  const descriptions = new Map();

  for (const { path, html: full } of pages) {
    const where = path;
    const html = full.replace(/<script(?! type="application\/ld\+json")[\s\S]*?<\/script>/g, '');
    const h1 = (html.match(/<h1[\s>]/g) || []).length;
    if (h1 !== 1) errors.push(`${where}: ${h1} <h1> elements (want 1)`);

    const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
    if (!title) errors.push(`${where}: missing <title>`);
    else if (titles.has(title)) errors.push(`${where}: duplicate title (also ${titles.get(title)})`);
    else titles.set(title, where);

    const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1];
    if (!desc || desc.length < 50) errors.push(`${where}: description missing or too short`);
    else if (descriptions.has(desc)) errors.push(`${where}: duplicate description (also ${descriptions.get(desc)})`);
    else descriptions.set(desc, where);

    const canonical = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
    if (canonical !== `${site}${path}`) errors.push(`${where}: canonical ${canonical} ≠ ${site}${path}`);

    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try { JSON.parse(m[1]); } catch { errors.push(`${where}: invalid JSON-LD`); }
    }

    for (const m of html.matchAll(/href="(\/[^"#?]*)/g)) {
      const href = m[1];
      if (!paths.has(href) && !/^\/(assets|bible)\//.test(href)) {
        errors.push(`${where}: broken internal link ${href}`);
      }
    }

    // Arabic text must not contain Latin letters (a sign of a field mix-up),
    // except inside example sentences, which may quote a translation.
    for (const m of html.matchAll(/<(?:span|div|h1|a)[^>]*class="(?:lemma )?ar"[^>]*>([^<]*)</g)) {
      if (/[A-Za-z]/.test(m[1].replace(/&[a-z]+;|&#\d+;/g, ''))) errors.push(`${where}: Latin text in Arabic field: ${m[1].slice(0, 40)}`);
    }
    if (/undefined|\[object Object\]|NaN/.test(html.replace(/<script[\s\S]*?<\/script>/g, ''))) {
      errors.push(`${where}: contains undefined/NaN/[object Object]`);
    }
  }
  return errors;
}
