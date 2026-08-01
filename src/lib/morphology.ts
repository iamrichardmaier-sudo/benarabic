// Reference material shown when inspecting a verb in the conjugation drill:
// what the bare root tends to mean, and what each verb form does to it.
//
// Root glosses are data and live in the `root_meanings` table (they differ per
// root and grow with the deck). Form semantics are fixed grammar — Form II is
// causative for every root there is — so they are a constant here rather than
// rows to keep in sync.

import { supabase } from '@/integrations/supabase/client';
import { isOnline } from '@/hooks/useOnlineStatus';

export interface VerbFormGloss {
  /** The pattern the root is poured into, written with ف-ع-ل. */
  pattern: string;
  /** A few words naming the effect. */
  summary: string;
  /** How the form bends the root meaning, in a sentence. */
  detail: string;
}

export const VERB_FORM_GLOSSES: Record<string, VerbFormGloss> = {
  I: {
    pattern: 'فَعَلَ',
    summary: 'The plain action',
    detail: 'The base form. It carries the root idea with nothing added — whatever the root means at its simplest.',
  },
  II: {
    pattern: 'فَعَّلَ',
    summary: 'Causative or intensive',
    detail: 'Doubling the middle letter either makes someone else do the action, or makes it thorough and repeated.',
  },
  III: {
    pattern: 'فاعَلَ',
    summary: 'Done to or with someone',
    detail: 'Stretching the first vowel points the action at another party — you do it to them, or alongside them.',
  },
  IV: {
    pattern: 'أَفعَلَ',
    summary: 'Causative',
    detail: 'A prefixed hamza makes something or someone undergo the root action. Often blunter and more transitive than Form II.',
  },
  V: {
    pattern: 'تَفَعَّلَ',
    summary: 'Form II turned back on itself',
    detail: 'Form II with تَـ in front: the subject undergoes or takes on that action themselves, rather than doing it to another.',
  },
  VI: {
    pattern: 'تَفاعَلَ',
    summary: 'Mutual, between parties',
    detail: 'Form III with تَـ in front: two or more parties do it to each other, back and forth.',
  },
  VII: {
    pattern: 'اِنفَعَلَ',
    summary: 'It simply happens',
    detail: 'The subject just undergoes the action, with nobody in view doing it. Close to an English passive with no agent.',
  },
  VIII: {
    pattern: 'اِفتَعَلَ',
    summary: 'Done for oneself',
    detail: 'An infixed تـ turns the action inward — done to or for the subject. Meanings here drift idiomatic more often than in other forms.',
  },
  IX: {
    pattern: 'اِفعَلَّ',
    summary: 'Colours and defects',
    detail: 'Reserved for turning a colour or taking on a physical defect. Rare outside that narrow job.',
  },
  X: {
    pattern: 'اِستَفعَلَ',
    summary: 'Seeking or deeming',
    detail: 'اِستَـ means asking for the root action, seeking it out, or judging something to have that quality.',
  },
};

const ROOT_CACHE_KEY = 'arabic-flashcards-root-meanings';

function readCachedRoots(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ROOT_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeCachedRoots(meanings: Record<string, string>): void {
  try {
    localStorage.setItem(ROOT_CACHE_KEY, JSON.stringify(meanings));
  } catch (err) {
    console.error('Could not cache root meanings:', err);
  }
}

/**
 * All known root glosses, keyed by root. Served from cache when offline (and
 * used as the fallback if the fetch fails), so hovering a root keeps working
 * on a plane the same as it does at a desk.
 */
export async function loadRootMeanings(): Promise<Record<string, string>> {
  const cached = readCachedRoots();
  if (!isOnline()) return cached;

  const { data, error } = await supabase.from('root_meanings').select('root, meaning');
  if (error || !data) {
    console.error('Could not load root meanings:', error);
    return cached;
  }

  const fresh: Record<string, string> = {};
  for (const row of data) fresh[row.root] = row.meaning;
  writeCachedRoots(fresh);
  return fresh;
}
