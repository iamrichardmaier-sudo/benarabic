/**
 * Google Analytics 4 — opt-in, no-op until configured.
 *
 * Set VITE_GA_MEASUREMENT_ID in the deploy environment (Netlify → Site
 * settings → Environment variables) to a real "G-XXXXXXXXXX" id. With the
 * variable unset — local dev, tests, previews — nothing is loaded and no
 * requests are made, so this stays inert rather than shipping a dead or
 * placeholder tracker.
 *
 * The static SEO pages carry their own copy of this snippet (see
 * scripts/seo/generate.mjs), since they are plain HTML outside the React app.
 */

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initialized = false;

export function initAnalytics(): void {
  if (initialized) return;
  if (!MEASUREMENT_ID || typeof document === 'undefined') return;
  initialized = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  const gtag = (...args: unknown[]) => {
    window.dataLayer!.push(args);
  };
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', MEASUREMENT_ID);
}

/** Whether analytics is configured — useful for tests and debug output. */
export function analyticsEnabled(): boolean {
  return !!MEASUREMENT_ID;
}
