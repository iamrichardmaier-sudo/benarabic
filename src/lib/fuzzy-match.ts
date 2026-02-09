/** Levenshtein distance between two strings */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Strip common articles from start of string */
function stripArticles(s: string): string {
  return s.replace(/^(the|a|an)\s+/i, '');
}

/** Normalize: lowercase, trim, strip articles */
function normalize(s: string): string {
  return stripArticles(s.trim().toLowerCase());
}

export type MatchResult = 'exact' | 'close' | 'wrong';

/**
 * Compare user answer to correct answer with fuzzy matching.
 * Returns 'exact' for exact match (after normalization),
 * 'close' for near-matches (typos, partial multi-word),
 * 'wrong' for no match.
 */
export function checkAnswer(userAnswer: string, correctAnswer: string): MatchResult {
  const ua = normalize(userAnswer);
  const ca = normalize(correctAnswer);

  if (!ua) return 'wrong';

  // Exact match after normalization
  if (ua === ca) return 'exact';

  // Check if correct answer has parenthetical info, e.g. "Upset (angry or sad)"
  // Accept match against the main word only
  const mainWord = normalize(correctAnswer.replace(/\s*\(.*?\)\s*/g, '').trim());
  if (mainWord && ua === mainWord) return 'exact';

  // Levenshtein for single words > 4 chars
  if (ca.split(/\s+/).length === 1 && ca.length > 4) {
    if (levenshtein(ua, ca) < 2) return 'close';
  }

  // Multi-word: check if 80% of words match
  const caWords = ca.split(/\s+/);
  const uaWords = ua.split(/\s+/);
  if (caWords.length > 1) {
    const matched = caWords.filter((w) => uaWords.includes(w));
    if (matched.length / caWords.length >= 0.8) return 'close';
  }

  // General levenshtein for longer strings
  if (ca.length > 4 && levenshtein(ua, ca) < 2) return 'close';

  // Check levenshtein against main word too
  if (mainWord && mainWord.length > 4 && levenshtein(ua, mainWord) < 2) return 'close';

  return 'wrong';
}
