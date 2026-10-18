import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import QuizRunner from './QuizRunner';
import { buildIdentify } from '@/lib/verb-forms/quiz';
import type { Conjugation } from '@/lib/verb-forms/data';
import { FORM_IDS } from '@/lib/verb-forms/generate';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ insert: () => Promise.resolve({ error: null }) }) },
}));

const rows: Conjugation[] = FORM_IDS.flatMap((form) =>
  ['ك-ت-ب', 'د-ر-س', 'ف-ت-ح'].map((root, i) => ({
    id: `${form}${i}`, root, form, past: `${form}${root}`, present: 'p', masdar: 'm', meaning: 'x', definition: null, usageNote: null,
    tier: 3, confidence: 'high' as const, weak: 'sound', source: 't', reviewed: false,
  })),
);

describe('QuizRunner', () => {
  it('shows the explanation after an answer and finishes with a score', () => {
    const { questions } = buildIdentify(rows, 1, () => 0.3, 3);
    render(<QuizRunner title="T" mode="identify" level={1} questions={questions} onExit={() => undefined} />);
    expect(screen.getByText('1 / 3')).toBeTruthy();

    const answer = questions[0].answer;
    fireEvent.click(screen.getAllByRole('button', { name: answer })[0]);
    expect(screen.getByRole('status').textContent).toBe('Correct');
    expect(screen.getByText(/Look for:/)).toBeTruthy();

    for (let i = 0; i < 3; i++) {
      if (i > 0) fireEvent.click(screen.getAllByRole('button', { name: questions[i].answer })[0]);
      fireEvent.click(screen.getByRole('button', { name: /Next|See results/ }));
    }
    expect(screen.getByText('3/3')).toBeTruthy();
  });
});
