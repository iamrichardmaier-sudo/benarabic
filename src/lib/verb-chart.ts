import { conjugate, PEOPLE, type Conjugation } from './conjugation';

/**
 * The persons the chart drills: the dual is left out.
 *
 * conjugate() still derives it — it belongs in a reference chart — but it is
 * vanishingly rare outside formal writing, and six of the twenty-seven blanks
 * is a lot of typing to spend on forms that hardly ever come up.
 */
export const CHART_PEOPLE = PEOPLE.filter((person) => person.number !== 'dual');

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
