/** 754 → "12:34". */
export function formatDuration(secs: number): string {
  const total = Math.max(0, Math.round(secs));
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * "2026-10-08" → "Oct 8".
 *
 * Built from the parts rather than `new Date('2026-10-08')`, which is read as
 * UTC midnight and so shows the previous day anywhere west of Greenwich.
 */
export function formatEpisodeDate(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return day;
  return new Date(y, m - 1, d).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
