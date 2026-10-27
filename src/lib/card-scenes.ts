import catalog from '../../supabase/functions/_shared/card-scenes.json';

/**
 * The little animated scenes shown with a card's meaning.
 *
 * The catalog lives beside the edge functions so the assign-scenes function
 * (which has Claude pick the best scene for each saved card) and the app read
 * one list. A card shows the scene stored on it; until one is stored, the
 * closest match for its English meaning is picked here, so no card is ever
 * left without one.
 */
export type SceneMotion =
  | 'float' | 'bounce' | 'wiggle' | 'spin' | 'pulse' | 'swing' | 'sway' | 'hop'
  | 'drive' | 'fly' | 'shake' | 'grow' | 'blink' | 'drift' | 'swim' | 'flicker';
export type SceneFx =
  | 'none' | 'sparkles' | 'hearts' | 'steam' | 'rain' | 'snow' | 'zzz' | 'notes'
  | 'bubbles' | 'leaves' | 'stars' | 'wind' | 'confetti' | 'drops' | 'rays';
export type SceneTone = 'warm' | 'green' | 'blue' | 'amber' | 'rose' | 'violet';

export interface CardScene {
  key: string;
  icon: string;
  motion: SceneMotion;
  fx: SceneFx;
  tone: SceneTone;
  keywords: string[];
}

export const SCENES = catalog as CardScene[];

const BY_KEY = new Map(SCENES.map((s) => [s.key, s]));

/** Shown for a sentence card that matches nothing more specific. */
const SENTENCE_SCENE = 'speech-bubble';
/** Shown when a meaning matches nothing at all. */
const FALLBACK_SCENE = 'language';

export const sceneByKey = (key: string | null | undefined): CardScene | undefined =>
  key ? BY_KEY.get(key) : undefined;

/** "To write (a letter)" → "write a letter": lower case, no "to"/articles/punctuation. */
function normalise(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z' ]+/g, ' ')} `
    .replace(/\s(to|a|an|the|be|is|are|of|one's|someone|something|sth|sb)\s/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The word with a common English ending taken off, so "books" finds "book". */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 3 && word.endsWith('ed')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 2 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** Each keyword, normalised, with the scenes that list it, in catalog order. */
const KEYWORDS: { phrase: string; words: string[]; scene: CardScene; rank: number }[] = SCENES.flatMap(
  (scene) => scene.keywords.map((k, rank) => {
    const phrase = normalise(k);
    return { phrase, words: phrase.split(' ').map(stem), scene, rank };
  }),
).filter((k) => k.phrase);

/**
 * The best scene for an English meaning. A whole-meaning match beats a
 * multi-word phrase found inside it, which beats a single word; ties go to
 * the scene listing that keyword earliest. Deterministic, so a card always
 * shows the same scene.
 */
export function guessScene(english: string | null | undefined, wordType?: string | null): CardScene {
  const fallback = BY_KEY.get(wordType === 'sentence' ? SENTENCE_SCENE : FALLBACK_SCENE)!;
  if (!english) return fallback;
  const whole = normalise(english);
  if (!whole) return fallback;
  const words = whole.split(' ').map(stem);
  const joined = ` ${words.join(' ')} `;

  let best: { score: number; rank: number; scene: CardScene } | null = null;
  for (const k of KEYWORDS) {
    let score = 0;
    if (k.phrase === whole) score = 100;
    else if (joined.includes(` ${k.words.join(' ')} `)) {
      score = 10 * k.words.length;
      // A match on the first word is usually the head of the meaning
      // ("book of prayers" is a book), so it edges out later ones.
      if (words[0] === k.words[0]) score += 5;
    }
    if (score === 0) continue;
    if (!best || score > best.score || (score === best.score && k.rank < best.rank)) {
      best = { score, rank: k.rank, scene: k.scene };
    }
  }
  return best?.scene ?? fallback;
}

/** The scene a card shows: the one stored on it, or the best guess from its meaning. */
export function sceneForCard(card: { scene?: string | null; english?: string | null; wordType?: string | null }): CardScene {
  return sceneByKey(card.scene) ?? guessScene(card.english, card.wordType);
}
