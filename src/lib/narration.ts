import type { NarrationWord } from '@/hooks/useLibraryTexts';

/** Which word is being said at `t`: the last one started, until the next begins. */
export function wordAt(words: NarrationWord[], t: number): number | null {
  let lo = 0;
  let hi = words.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid].s <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (found < 0) return null;
  // Hold a word through the short pause after it, but not through a long one
  // such as the gap before a new paragraph.
  return t <= words[found].e + 0.6 ? words[found].i : null;
}
