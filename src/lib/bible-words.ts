import { tokenize } from '@/lib/transcript-mask';

/**
 * The tagging pipeline strips the same leading/trailing punctuation before
 * treating two occurrences as "the same word" — matching that here is what lets
 * a word in running text find its row in bible_word_tags.
 */
const EDGE_PUNCTUATION = /^[.,،؛:؟!"«»()]+|[.,،؛:؟!"«»()]+$/g;

export function lookupKey(word: string): string {
  return word.replace(EDGE_PUNCTUATION, '');
}

/** Every word in a chapter, for one bulk tag lookup per chapter rather than
 *  one query per verse. */
export function chapterWords(verses: { a: string }[]): string[] {
  const words: string[] = [];
  for (const v of verses) {
    for (const token of tokenize(v.a)) {
      if (token.isWord) words.push(lookupKey(token.text));
    }
  }
  return words;
}
