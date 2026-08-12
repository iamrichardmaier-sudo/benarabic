/** Extracts the first number in a label like "Chapter 12", for numeric ordering. */
function chapterNumber(label: string): number | null {
  const m = label.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Sorts chapter-style labels numerically (Chapter 2 before Chapter 10) rather
 * than alphabetically. Labels without a number sort after numbered ones,
 * alphabetically among themselves.
 */
export function sortChapterLabels(labels: string[]): string[] {
  return [...labels].sort((a, b) => {
    const na = chapterNumber(a);
    const nb = chapterNumber(b);
    if (na !== null && nb !== null) return na - nb;
    if (na !== null) return -1;
    if (nb !== null) return 1;
    return a.localeCompare(b);
  });
}
