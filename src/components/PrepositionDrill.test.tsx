import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrepositionDrill from './PrepositionDrill';
import { createCard, type FlashCard } from '@/lib/spaced-repetition';

function tagged(word: string, prep: string, sentence: string, extra: Partial<FlashCard> = {}): FlashCard {
  return {
    ...createCard(word, 'to succeed in'),
    fixedPreposition: prep,
    prepositionSentence: sentence,
    prepositionSentenceEn: 'I succeeded in the exam.',
    ...extra,
  };
}

describe('PrepositionDrill', () => {
  it('shows the empty state when nothing is tagged', () => {
    render(<PrepositionDrill cards={[createCard('بَحر', 'sea')]} onBack={() => {}} />);
    expect(screen.getByText('No preposition-tagged words yet.')).toBeInTheDocument();
  });

  it('ignores cards missing a sentence or a preposition', () => {
    const cards = [
      tagged('a', 'في', 'نَجَحتُ ___ الاِمتِحان.'),
      { ...createCard('b', 'x'), fixedPreposition: 'في', prepositionSentence: null },
      { ...createCard('c', 'x'), fixedPreposition: null, prepositionSentence: 'نَجَحتُ ___ الاِمتِحان.' },
    ];
    render(<PrepositionDrill cards={cards} onBack={() => {}} />);
    // Only the first card is drillable — the empty state should not show.
    expect(screen.queryByText('No preposition-tagged words yet.')).not.toBeInTheDocument();
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
  });

  it('splits the sentence around the blank and renders an inline input', () => {
    render(
      <PrepositionDrill
        cards={[tagged('نَجَحَ', 'في', 'نَجَحتُ ___ الاِمتِحان الأَخير.')]}
        onBack={() => {}}
      />,
    );
    expect(screen.getByText('نَجَحتُ')).toBeInTheDocument();
    expect(screen.getByText('الاِمتِحان الأَخير.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'The missing preposition' })).toBeInTheDocument();
  });

  it('accepts the correct preposition, tashkeel-insensitive', async () => {
    const user = userEvent.setup();
    render(
      <PrepositionDrill
        cards={[tagged('نَجَحَ', 'في', 'نَجَحتُ ___ الاِمتِحان.')]}
        onBack={() => {}}
      />,
    );
    await user.type(screen.getByRole('textbox', { name: 'The missing preposition' }), 'في');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('I succeeded in the exam.')).toBeInTheDocument();
    expect(screen.getByText('1 correct')).toBeInTheDocument();
  });

  it('matches a bare clitic against its tatweel citation form', async () => {
    const user = userEvent.setup();
    render(
      <PrepositionDrill
        cards={[tagged('مَشغول', 'بِـ', 'أَنا مَشغولٌ ___ العَمَل.')]}
        onBack={() => {}}
      />,
    );
    await user.type(screen.getByRole('textbox', { name: 'The missing preposition' }), 'ب');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('1 correct')).toBeInTheDocument();
  });

  it('rejects the wrong preposition and reveals the right one', async () => {
    const user = userEvent.setup();
    render(
      <PrepositionDrill
        cards={[tagged('نَجَحَ', 'في', 'نَجَحتُ ___ الاِمتِحان.')]}
        onBack={() => {}}
      />,
    );
    await user.type(screen.getByRole('textbox', { name: 'The missing preposition' }), 'على');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('0 correct')).toBeInTheDocument();
    // The reconstructed sentence reveals the right preposition.
    expect(screen.getByText('في', { selector: 'span' })).toBeInTheDocument();
  });

  it('moves to the next item and finishes with a score', async () => {
    const user = userEvent.setup();
    render(
      <PrepositionDrill
        cards={[tagged('نَجَحَ', 'في', 'نَجَحتُ ___ الاِمتِحان.')]}
        onBack={() => {}}
      />,
    );
    await user.type(screen.getByRole('textbox', { name: 'The missing preposition' }), 'في');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(screen.getByRole('button', { name: 'Next →' }));
    expect(screen.getByText('Drill Complete!')).toBeInTheDocument();
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
  });

  it('does not drill the same card twice even if it appears twice', () => {
    const card = tagged('نَجَحَ', 'في', 'نَجَحتُ ___ الاِمتِحان.');
    render(<PrepositionDrill cards={[card, card]} onBack={() => {}} />);
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
  });
});
