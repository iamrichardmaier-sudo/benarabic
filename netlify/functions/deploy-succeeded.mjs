/**
 * Netlify runs a function named `deploy-succeeded` after every successful
 * deploy. This one tells IndexNow (Bing, Yandex, Seznam, Naver …; Bing also
 * feeds DuckDuckGo and ChatGPT search) which reference pages changed, so they
 * are recrawled within hours instead of weeks. No account is needed: the key
 * file at /<key>.txt proves we own the site.
 *
 * The list of changed pages is written at build time by
 * scripts/seo/generate.mjs (it compares page hashes with the live site's
 * previous /seo-manifest.json) and published as /indexnow-pending.json.
 */

const SITE = 'https://waznarabic.com';
const KEY = 'ad4136aac28b0f6fb43c549d90328ac0';
const BATCH = 10000; // IndexNow's per-request limit

export const handler = async (event) => {
  try {
    const payload = JSON.parse(event.body || '{}').payload || {};
    // Only production deploys of the canonical site; previews and branch
    // deploys have other URLs and must not be submitted.
    if (payload.context && payload.context !== 'production') {
      return { statusCode: 200, body: 'skipped: not production' };
    }

    const res = await fetch(`${SITE}/indexnow-pending.json`, { cache: 'no-store' });
    if (!res.ok) return { statusCode: 200, body: `no pending list (${res.status})` };
    const { urls = [] } = await res.json();
    if (!urls.length) return { statusCode: 200, body: 'nothing changed' };

    const host = new URL(SITE).host;
    let sent = 0;
    for (let i = 0; i < urls.length; i += BATCH) {
      const urlList = urls.slice(i, i + BATCH);
      const r = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList }),
      });
      console.log(`IndexNow: ${urlList.length} URLs → ${r.status}`);
      if (r.ok) sent += urlList.length;
    }
    return { statusCode: 200, body: `submitted ${sent} of ${urls.length}` };
  } catch (err) {
    // Never fail loudly: a missed ping only delays recrawling.
    console.error('IndexNow submission failed', err);
    return { statusCode: 200, body: 'error logged' };
  }
};
