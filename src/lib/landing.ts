/**
 * The logged-out home page lives as static HTML inside index.html, so search
 * engines and first-time visitors get real content before any JavaScript
 * runs. It is captured here before React takes over #root, and the Landing
 * page renders the same markup, so there is one copy of the content.
 */
let landingHtml = '';

export function captureLandingHtml(): void {
  if (typeof document === 'undefined') return;
  landingHtml = document.getElementById('landing')?.innerHTML ?? '';
}

export function getLandingHtml(): string {
  return landingHtml;
}

/** True when Supabase has a stored session, i.e. this is probably a signed-in user. */
export function hasStoredSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      if (/^sb-.*-auth-token$/.test(localStorage.key(i) ?? '')) return true;
    }
  } catch {
    // Storage blocked: treat as signed out.
  }
  return false;
}
