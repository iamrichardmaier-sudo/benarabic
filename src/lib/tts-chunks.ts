/**
 * The longest run of text handed to the model at once.
 *
 * Kokoro degrades on very long inputs — the prosody drifts and it can trail
 * off — so text is fed to it a paragraph or two at a time. Short enough to
 * stay clean, long enough that sentences keep their intonation.
 */
export const MAX_CHUNK = 450;

/** A marker no document contains, used to cut between sentences. */
const SPLIT = '⁣SPLIT⁣';

/** Sentence ends, including the ones that close a quote or bracket. */
const SENTENCE_END = /([.!?]["')\]]?)\s+/g;

/**
 * Text as it comes out of a PDF, tidied into something worth reading aloud.
 *
 * PDFs break lines at the column edge, so a paragraph arrives as a stack of
 * short lines with hyphens where words were split. Read literally that comes
 * out as a list rather than prose.
 */
export function tidyForSpeech(raw: string): string {
  return (
    raw
      // A word broken across a line break is one word.
      .replace(/(\w)-\n(\w)/g, '$1$2')
      // Page furniture: a line that is nothing but a number.
      .replace(/\n[ \t]*\d+[ \t]*\n/g, '\n\n')
      // A single line break inside a paragraph is just the column edge.
      .replace(/([^\n])\n(?!\n)/g, '$1 ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

/**
 * Split text into pieces the model can voice one at a time.
 *
 * Broken at sentence ends wherever possible, so a chunk boundary lands where
 * a reader would pause anyway and the joins are inaudible. A sentence longer
 * than the limit on its own is cut at a comma, and failing that at a space,
 * rather than being handed over whole.
 */
export function chunkForSpeech(text: string, max: number = MAX_CHUNK): string[] {
  const clean = tidyForSpeech(text);
  if (!clean) return [];

  const out: string[] = [];
  // Paragraph by paragraph, and never across a paragraph boundary: each chunk
  // is followed by a short silence when the audio is assembled, so running two
  // paragraphs together would lose the pause between them.
  for (const paragraph of clean.split(/\n{2,}/)) {
    const sentences = paragraph
      .replace(SENTENCE_END, `$1${SPLIT}`)
      .split(SPLIT)
      .map((s) => s.trim())
      .filter(Boolean);

    let current = '';
    const flush = () => {
      if (current.trim()) out.push(current.trim());
      current = '';
    };

    for (const sentence of sentences) {
      if (sentence.length > max) {
        flush();
        out.push(...splitLongSentence(sentence, max));
        continue;
      }
      if (current && current.length + sentence.length + 1 > max) flush();
      current = current ? `${current} ${sentence}` : sentence;
    }
    flush();
  }
  return out;
}

/** A sentence too long to voice in one go, cut where a reader would breathe. */
function splitLongSentence(sentence: string, max: number): string[] {
  const parts: string[] = [];
  let rest = sentence;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    // A comma is the next best pause after a full stop; a space is the last
    // resort, since cutting mid-word would be audible.
    const at = Math.max(window.lastIndexOf(', '), window.lastIndexOf('; '));
    const cut = at > max * 0.4 ? at + 1 : window.lastIndexOf(' ');
    if (cut <= 0) break;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

/** Roughly how long the finished reading will run, for an estimate up front. */
export function estimateSeconds(text: string, wordsPerMinute = 165): number {
  const words = tidyForSpeech(text).split(/\s+/).filter(Boolean).length;
  return Math.round((words / wordsPerMinute) * 60);
}
