import type { TaggedImportEntry } from '@/lib/import-tagged';
import { createDeck, ensureWord, setDeckWords, addDecksToLearn, setCardImage, type Deck } from '@/lib/deck-store';
import { searchImage } from '@/lib/unsplash';
import { nextFreeIcon } from '@/lib/deck-icons';

/** What every import deck is called before the learner renames it. */
export const ADDED_WORDS_PREFIX = 'Added Words';

/**
 * The name for this import's deck.
 *
 * Every batch gets its own deck rather than piling into one running list, so
 * a session can be found, renamed, or thrown away on its own. The number is
 * the next free one, not a count — deleting "Added Words 2" should not make
 * the next import collide with "Added Words 3".
 */
export function nextAddedWordsTitle(existingTitles: Iterable<string>): string {
  const taken = new Set<number>();
  const pattern = new RegExp(`^${ADDED_WORDS_PREFIX}\\s+(\\d+)$`);
  for (const title of existingTitles) {
    const match = title.trim().match(pattern);
    if (match) taken.add(Number(match[1]));
  }
  let n = 1;
  while (taken.has(n)) n++;
  return `${ADDED_WORDS_PREFIX} ${n}`;
}

/**
 * The prompt a learner pastes into their own Claude.
 *
 * It describes the fields rather than showing a worked example, so the model
 * is not tempted to echo the example's vocabulary back instead of the words
 * actually asked for.
 */
export const IMPORT_PROMPT = `I am going to give you a list of Arabic vocabulary. Return it as a JSON array and nothing else — no commentary before or after, no markdown code fence.

Each element is one word, with these fields:

- "fusha" (required): the word in Modern Standard Arabic, fully vowelled with harakat.
- "english" (required): a short English meaning, a few words at most.
- "shaami" (optional): the Levantine colloquial equivalent, if it differs.
- "root" (optional): the root, letters joined by hyphens, e.g. "ك-ت-ب". Omit for a word with no derivable root.
- "wordType" (optional): one of "verb", "noun", "adjective", "participle", "masdar", "other".
- "verbForm" (optional): the Roman numeral I to X, for a verb or a form derived from one.
- "pastTense", "presentTense", "masdarForm" (optional): for a verb, the fully vowelled third-person-masculine-singular past, the present, and the verbal noun.
- "gender" (optional): "m" or "f", for a noun only. Judge the word itself, not its meaning.
- "fushaPlural" (optional): for a noun, the fully vowelled plural.
- "companionForms" (optional): up to four common words sharing the same root, each an object with "form" (vowelled Arabic) and "label" (a short grammatical description).

Leave out any optional field you are not confident about rather than guessing. Here is the vocabulary:`;

export interface ImportResult {
  deck: Deck;
  words: number;
}

/**
 * Put an import into its own deck.
 *
 * The words go into the shared bank as well, so they turn up in Build Your
 * Own Deck for everyone — but the deck itself stays private to whoever
 * imported it. Sharing a word is useful; publishing someone's homework is not.
 */
export async function importIntoNewDeck(
  entries: TaggedImportEntry[],
  userId: string,
  existingTitles: Iterable<string>,
  usedIcons: Iterable<string>,
): Promise<ImportResult> {
  const deck = await createDeck({
    title: nextAddedWordsTitle(existingTitles),
    icon: nextFreeIcon(usedIcons),
    createdBy: userId,
    isPublic: false,
  });

  const wordIds: string[] = [];
  for (const entry of entries) {
    const word = await ensureWord({
      word: entry.fusha,
      wordVoweled: entry.wordVoweled ?? entry.fusha,
      english: entry.english,
      shaami: entry.shaami ?? null,
      root: entry.root ?? null,
      wordType: entry.wordType ?? null,
      verbForm: entry.verbForm ?? null,
      pastTense: entry.pastTense ?? null,
      presentTense: entry.presentTense ?? null,
      masdarForm: entry.masdarForm ?? null,
      gender: entry.gender ?? null,
      fushaPlural: entry.fushaPlural ?? null,
      shaamiPlural: entry.shaamiPlural ?? null,
      companionForms: entry.companionForms ?? null,
      exampleSentence: null,
      exampleSentenceEn: null,
    });
    wordIds.push(word.id);
  }

  await setDeckWords(deck.id, wordIds);
  // Straight into Learn: an import is words the learner wants now. This is
  // also what creates the cards, which is why the pictures come after it.
  await addDecksToLearn([deck.id], userId);

  // imageQuery has been part of this schema from the start, so it keeps
  // working. A picture that cannot be found is not worth failing an import
  // over — the card is perfectly usable without one.
  for (let i = 0; i < entries.length; i++) {
    const query = entries[i].imageQuery || entries[i].english;
    if (!query) continue;
    try {
      const { imageUrl } = await searchImage(query);
      if (imageUrl) await setCardImage(userId, wordIds[i], imageUrl);
    } catch {
      /* no picture for this one */
    }
  }

  return { deck, words: wordIds.length };
}
