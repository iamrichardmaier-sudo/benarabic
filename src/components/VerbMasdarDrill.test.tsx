import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VerbMasdarDrill from './VerbMasdarDrill';
import { createCard, type FlashCard } from '@/lib/spaced-repetition';

/** A verb paired with its masdar, the only shape this drill draws items from. */
function pair(): FlashCard[] {
  const verb: FlashCard = { ...createCard('كَتَبَ', 'to write'), wordType: 'verb', pairedWordId: 'masdar-1' };
  verb.id = 'verb-1';
  const masdar: FlashCard = { ...createCard('كِتابة', 'writing'), wordType: 'masdar', pairedWordId: 'verb-1' };
  masdar.id = 'masdar-1';
  return [verb, masdar];
}

describe('VerbMasdarDrill', () => {
  it('shows the empty state when nothing is paired', () => {
    render(<VerbMasdarDrill cards={[createCard('بَحر', 'sea')]} onBack={() => {}} />);
    expect(screen.getByText('No paired verbs and masdars found.')).toBeInTheDocument();
  });
});

describe('VerbMasdarDrill keyboard shortcuts', () => {
  async function answerCorrectly(user: ReturnType<typeof userEvent.setup>) {
    const box = screen.getByRole('textbox');
    const expected = /Type the masdar/.test(screen.getByText(/Type the/).textContent ?? '')
      ? 'كِتابة'
      : 'كَتَبَ';
    await user.type(box, expected);
  }

  it('checks on Enter, then advances to completion on a second Enter', async () => {
    const user = userEvent.setup();
    render(<VerbMasdarDrill cards={pair()} onBack={() => {}} />);
    await answerCorrectly(user);
    await user.keyboard('{Enter}');
    expect(screen.getByText('1 correct')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(screen.getByText('Drill Complete!')).toBeInTheDocument();
  });

  it('accepts a wrong answer on Space and updates the score', async () => {
    const user = userEvent.setup();
    render(<VerbMasdarDrill cards={pair()} onBack={() => {}} />);
    await user.type(screen.getByRole('textbox'), 'شيء غير صحيح');
    await user.keyboard('{Enter}');
    expect(screen.getByText('0 correct')).toBeInTheDocument();

    await user.keyboard(' ');
    expect(screen.getByText('1 correct')).toBeInTheDocument();
  });

  it('does not double-count when Space is pressed after an already-correct answer', async () => {
    const user = userEvent.setup();
    render(<VerbMasdarDrill cards={pair()} onBack={() => {}} />);
    await answerCorrectly(user);
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(screen.getByText('1 correct')).toBeInTheDocument();
  });
});
