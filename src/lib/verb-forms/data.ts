import { supabase } from '@/integrations/supabase/client';
import { isOnline } from '@/hooks/useOnlineStatus';
import { rootKey } from '@/lib/word-relations';
import { VERB_FORM_GLOSSES } from '@/lib/morphology';
import { FORM_IDS, type FormId } from './generate';

export type Confidence = 'high' | 'medium' | 'low';

export interface Conjugation {
  id: string;
  root: string;
  form: FormId;
  past: string;
  present: string;
  masdar: string | null;
  meaning: string | null;
  /** 0 = not attested, 1 rare, 2 occasional, 3 common, 4 very common. An estimate. */
  tier: number;
  confidence: Confidence;
  weak: string;
  source: string;
  reviewed: boolean;
}

interface Row {
  id: string;
  root: string;
  form: FormId;
  past: string;
  present: string;
  masdar: string | null;
  meaning_en: string | null;
  usage_tier: number;
  confidence: Confidence;
  weak_type: string;
  source: string;
  reviewed_at: string | null;
}

/** The Forms tables are newer than the generated Supabase types. */
export const formsTable = (name: 'verb_conjugations' | 'form_quiz_results') =>
  (supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }).from(name);

const CACHE_KEY = 'wazn-verb-conjugations-v1';

const toConjugation = (r: Row): Conjugation => ({
  id: r.id,
  root: r.root,
  form: r.form,
  past: r.past,
  present: r.present,
  masdar: r.masdar,
  meaning: r.meaning_en,
  tier: r.usage_tier,
  confidence: r.confidence,
  weak: r.weak_type,
  source: r.source,
  reviewed: r.reviewed_at !== null,
});

/** Every stored paradigm. Served from cache offline, like the root glosses. */
export async function loadConjugations(): Promise<Conjugation[]> {
  const read = (): Conjugation[] => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? (JSON.parse(raw) as Conjugation[]) : [];
    } catch {
      return [];
    }
  };
  if (!isOnline()) return read();
  const { data, error } = await formsTable('verb_conjugations').select('*').limit(5000);
  if (error || !data) return read();
  const rows = (data as unknown as Row[]).map(toConjugation);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
  } catch {
    /* the cache is a convenience */
  }
  return rows;
}

export function dropConjugationCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* nothing to drop */
  }
}

export interface FormFact {
  form: FormId;
  pattern: string;
  summary: string;
  detail: string;
  /** What to look for on the page. */
  clue: string;
}

const CLUES: Record<FormId, string> = {
  I: 'No letters beyond the three root letters.',
  II: 'The middle root letter carries a shadda.',
  III: 'A long ā after the first root letter.',
  IV: 'A أَ prefix in the past tense (يُ in the present).',
  V: 'تَ in front of a doubled middle letter.',
  VI: 'تَ in front, then a long ā after the first root letter.',
  VII: 'An اِنْ prefix.',
  VIII: 'A تـ tucked in right after the first root letter.',
  IX: 'اِ prefix and a doubled last letter: a colour or a defect.',
  X: 'An اِسْتَ prefix.',
};

export const FORM_FACTS: Record<FormId, FormFact> = Object.fromEntries(
  FORM_IDS.map((form) => [
    form,
    {
      form,
      pattern: VERB_FORM_GLOSSES[form].pattern,
      summary: VERB_FORM_GLOSSES[form].summary,
      detail: VERB_FORM_GLOSSES[form].detail,
      clue: CLUES[form],
    },
  ]),
) as Record<FormId, FormFact>;

/** Group paradigms by root, hamza-folded so ء-م-ن and أ-م-ن are one root. */
export function groupByRoot(rows: Conjugation[]): Map<string, Conjugation[]> {
  const out = new Map<string, Conjugation[]>();
  for (const r of rows) {
    const k = rootKey(r.root);
    out.set(k, [...(out.get(k) ?? []), r]);
  }
  return out;
}
