import { conjugate, type Conjugation } from './conjugation';

/** The pieces of a tagged card the full chart is built from. */
export interface ChartVerb {
  root: string;
  verbForm: string;
  pastTense: string;
  presentTense: string;
  masdarForm: string;
}

/**
 * The verbs whose full chart can actually be derived, paired with that chart.
 *
 * Quadriliterals, passives and phrases ("ما زالَ") have no paradigm here to
 * derive, so they are dropped rather than charted wrongly.
 */
export function chartable(verbs: ChartVerb[]): { verb: ChartVerb; chart: Conjugation }[] {
  const out: { verb: ChartVerb; chart: Conjugation }[] = [];
  for (const verb of verbs) {
    const chart = conjugate({ root: verb.root, past: verb.pastTense, present: verb.presentTense });
    if (chart) out.push({ verb, chart });
  }
  return out;
}
