import type { FlashCard, CompanionForm } from '@/lib/spaced-repetition';
import type { WordSense } from '@/hooks/useWordSkeletonIndex';

/**
 * Everything known about one word met while reading — the same set of facts a
 * flashcard carries, so the reader's panel can be the card's panel.
 *
 * The shared scripture index stores the older, thinner {lemma, gloss, …}
 * shape, and a text tagged since stores this one. Both are accepted: the
 * reader merges the two sources, and a word should not read differently
 * depending on which of them it came from.
 */
export interface TaggedSense {
  /** The word fully voweled. */
  word?: string;
  /** Older shape, from the shared index. */
  lemma?: string;
  english?: string | null;
  /** Older shape, from the shared index. */
  gloss?: string | null;
  root?: string | null;
  wordType?: string | null;
  /** Older shape, from the shared index. */
  pos?: string | null;
  verbForm?: string | null;
  gender?: 'm' | 'f' | null;
  fushaPlural?: string | null;
  shaami?: string | null;
  pastTense?: string | null;
  presentTense?: string | null;
  masdarForm?: string | null;
  companionForms?: CompanionForm[] | null;
}

/** The headline form of a sense, whichever shape it was stored in. */
export function senseWord(sense: TaggedSense, fallback: string): string {
  return sense.word || sense.lemma || fallback;
}

/** Its English, whichever shape it was stored in. */
export function senseEnglish(sense: TaggedSense): string {
  return sense.english || sense.gloss || '';
}

/**
 * A sense as a card, so WordDetail can describe it.
 *
 * Not a real card and never saved as one — it is a shape, so that one
 * component can describe a word whether it came from the deck, from the
 * scripture index, or from a text the reader tagged themselves.
 */
export function senseToCard(sense: TaggedSense, surface: string): FlashCard {
  const word = senseWord(sense, surface);
  return {
    id: `reader:${word}`,
    word,
    wordVoweled: word,
    english: senseEnglish(sense) || null,
    imageUrl: null,
    nextReviewDate: '',
    intervalDays: 0,
    easeFactor: 0,
    learningStage: 'new',
    stage1Attempts: 0,
    stage2Attempts: 0,
    root: sense.root ?? null,
    wordType: (sense.wordType ?? sense.pos ?? null) as FlashCard['wordType'],
    verbForm: (sense.verbForm ?? null) as FlashCard['verbForm'],
    gender: sense.gender ?? null,
    fushaPlural: sense.fushaPlural ?? null,
    shaami: sense.shaami ?? null,
    shaamiPlural: null,
    pastTense: sense.pastTense ?? null,
    presentTense: sense.presentTense ?? null,
    masdarForm: sense.masdarForm ?? null,
    companionForms: sense.companionForms ?? null,
  };
}

/** The shared index's shape widened to this one, so the two can be merged. */
export function fromWordSense(sense: WordSense): TaggedSense {
  return {
    lemma: sense.lemma,
    gloss: sense.gloss,
    root: sense.root,
    pos: sense.pos,
    verbForm: sense.verbForm,
  };
}
