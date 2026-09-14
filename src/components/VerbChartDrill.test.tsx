import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VerbChartDrill from './VerbChartDrill';
import { chartable, type ChartVerb } from '@/lib/verb-chart';
import { PEOPLE } from '@/lib/conjugation';
import { CHART_PEOPLE } from '@/lib/verb-chart';

const kataba: ChartVerb = {
  root: 'ك-ت-ب',
  verbForm: 'I',
  pastTense: 'كَتَبَ',
  presentTense: 'يَكْتُب',
  masdarForm: 'كِتابة',
};

const darasa: ChartVerb = {
  root: 'د-ر-س',
  verbForm: 'I',
  pastTense: 'دَرَسَ',
  presentTense: 'يَدرُس',
  masdarForm: 'دِراسة',
};

/** A phrase entry, of the kind that has no paradigm to derive. */
const notAVerb: ChartVerb = {
  root: 'ز-ي-ل',
  verbForm: 'I',
  pastTense: 'ما زالَ',
  presentTense: 'ما يَزالُ',
  masdarForm: '—',
};

function draw(verbs: ChartVerb[] = [kataba], ignoreShortVowels = false) {
  return render(
    <VerbChartDrill
      verbs={verbs}
      rootMeanings={{ 'ك-ت-ب': 'writing' }}
      ignoreShortVowels={ignoreShortVowels}
      onBack={() => {}}
    />,
  );
}

const cell = (name: string) => screen.getByRole('textbox', { name }) as HTMLInputElement;

describe('chartable', () => {
  it('keeps the verbs a chart can be derived for and drops the rest', () => {
    expect(chartable([kataba, notAVerb, darasa]).map((e) => e.verb.root)).toEqual([
      'ك-ت-ب',
      'د-ر-س',
    ]);
  });
});

describe('VerbChartDrill', () => {
  it('lays out a blank for the masdar and for every charted person in both tenses', () => {
    draw();
    expect(screen.getByRole('textbox', { name: 'Masdar' })).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(1 + CHART_PEOPLE.length * 2);
    // Every charted person is a row of the table, labelled by its pronoun.
    for (const person of CHART_PEOPLE) {
      expect(screen.getByRole('textbox', { name: `${person.english} past` })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: `${person.english} present` })).toBeInTheDocument();
    }
  });

  it('leaves the dual out', () => {
    draw();
    expect(CHART_PEOPLE).toHaveLength(PEOPLE.length - 3);
    for (const person of PEOPLE.filter((p) => p.number === 'dual')) {
      expect(screen.queryByRole('textbox', { name: `${person.english} past` })).toBeNull();
      expect(screen.queryByRole('textbox', { name: `${person.english} present` })).toBeNull();
    }
    expect(screen.queryByText('Dual')).toBeNull();
  });

  it('grades each cell and shows the answer for the ones that are wrong', async () => {
    const user = userEvent.setup();
    draw();
    await user.type(cell('I past'), 'كَتَبْتُ');
    await user.type(cell('she past'), 'كَتَبَ');
    await user.click(screen.getByRole('button', { name: 'Check Chart' }));

    expect(cell('I past')).toHaveClass('border-success');
    expect(cell('she past')).toHaveClass('border-destructive');
    // The blanks left empty count against the chart, not as free passes.
    expect(screen.getByText('1 / 21 correct on this chart')).toBeInTheDocument();
    // And the real form is put on screen next to what was typed.
    expect(screen.getByText('كَتَبَتْ')).toBeInTheDocument();
  });

  it('accepts a bare-letters answer when short vowels are switched off', async () => {
    const user = userEvent.setup();
    draw([kataba], true);
    await user.type(cell('I past'), 'كتبت');
    await user.click(screen.getByRole('button', { name: 'Check Chart' }));
    expect(cell('I past')).toHaveClass('border-success');
  });

  it('walks Enter to the next empty blank instead of submitting early', async () => {
    const user = userEvent.setup();
    draw();
    cell('Masdar').focus();
    await user.keyboard('كِتابة{Enter}');
    expect(cell('I past')).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Check Chart' })).toBeInTheDocument();
  });

  it('checks once the last blank is filled, and does not skip the answers', async () => {
    const user = userEvent.setup();
    draw();
    // One cell short of a full chart, so Enter from it has nowhere left to go.
    for (const input of screen.getAllByRole('textbox')) {
      if (input !== cell('they (f.) present')) await user.type(input, 'س');
    }
    cell('they (f.) present').focus();
    await user.keyboard('س{Enter}');

    // Enter checked the chart. If the same keypress also reached the window
    // listener, the drill would already have moved on and the marked-up chart
    // would never be seen.
    expect(screen.getByRole('button', { name: /Continue/ })).toBeInTheDocument();
    expect(screen.getByText(/correct on this chart/)).toBeInTheDocument();
  });

  it('moves to the next verb on Continue and starts it blank', async () => {
    const user = userEvent.setup();
    draw([kataba, darasa]);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    await user.type(cell('I past'), 'كَتَبْتُ');
    await user.click(screen.getByRole('button', { name: 'Check Chart' }));
    await user.click(screen.getByRole('button', { name: /Continue/ }));

    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(cell('I past')).toHaveValue('');
    expect(cell('I past')).not.toBeDisabled();
  });

  it('totals the cells across every chart at the end', async () => {
    const user = userEvent.setup();
    draw([kataba]);
    await user.type(cell('I past'), 'كَتَبْتُ');
    await user.click(screen.getByRole('button', { name: 'Check Chart' }));
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    expect(screen.getByText('Charts complete!')).toBeInTheDocument();
    expect(screen.getByText('1 / 21 cells correct (5%)')).toBeInTheDocument();
  });

  it('says so rather than showing an empty table when nothing is chartable', () => {
    draw([notAVerb]);
    expect(screen.getByText('No chartable verbs in this selection.')).toBeInTheDocument();
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });
});
