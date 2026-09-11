import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NumbersDrill from './NumbersDrill';
import type { FlashCard } from '@/lib/spaced-repetition';

const book = {
  id: '1', word: 'كتاب', wordVoweled: 'كِتاب', english: 'book',
  wordType: 'noun', fushaPlural: 'كُتُب', gender: 'm', root: 'ك-ت-ب',
} as FlashCard;

const magazine = {
  id: '2', word: 'مجلة', wordVoweled: 'مَجَلّة', english: 'magazine',
  wordType: 'noun', fushaPlural: 'مَجَلّات', gender: 'f',
} as FlashCard;

afterEach(() => {
  vi.restoreAllMocks();
});

/** Pins the noun and the number so a round can be asserted on. */
function startWith(cards: FlashCard[]) {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  return render(<NumbersDrill cards={cards} onBack={() => {}} />);
}

describe('NumbersDrill setup', () => {
  it('says so when no noun can be counted yet', () => {
    render(<NumbersDrill cards={[{ ...book, fushaPlural: null }]} onBack={() => {}} />);
    expect(screen.getByText(/No nouns ready to drill/i)).toBeInTheDocument();
  });

  it('offers a box per rule, not per round number', () => {
    render(<NumbersDrill cards={[book]} onBack={() => {}} />);
    expect(screen.getByText('3–10')).toBeInTheDocument();
    expect(screen.getByText(/the numeral flips gender/i)).toBeInTheDocument();
    expect(screen.getByText('10,000–1,000,000')).toBeInTheDocument();
  });

  it('will not start with every box cleared', async () => {
    const user = userEvent.setup();
    render(<NumbersDrill cards={[book]} onBack={() => {}} />);
    for (const label of ['1–2', '3–10', '11–99']) {
      await user.click(screen.getByText(label));
    }
    expect(screen.getByRole('button', { name: /Pick at least one range/i })).toBeDisabled();
  });
});

describe('NumbersDrill rounds', () => {
  it('marks the reversed numeral and the plural noun right', async () => {
    // Math.random pinned to 0 gives the first range (1–2 is off, so 3–10)
    // at its minimum: three books.
    const user = userEvent.setup();
    startWith([book]);
    await user.click(screen.getByText('1–2'));
    await user.click(screen.getByText('11–99'));
    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(screen.getByText('٣')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/The number, in words/i), 'ثلاثة');
    await user.type(screen.getByLabelText(/The noun/i), 'كتب');
    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(screen.getByText('1/1')).toBeInTheDocument();
    expect(screen.getByText(/flips to the opposite gender/i)).toBeInTheDocument();
  });

  it('marks an unreversed numeral wrong and shows what was wanted', async () => {
    const user = userEvent.setup();
    startWith([book]);
    await user.click(screen.getByText('1–2'));
    await user.click(screen.getByText('11–99'));
    await user.click(screen.getByRole('button', { name: 'Start' }));

    // ثلاث is the feminine-noun form; كِتاب is masculine, so it needs the ة.
    await user.type(screen.getByLabelText(/The number, in words/i), 'ثلاث');
    await user.type(screen.getByLabelText(/The noun/i), 'كتب');
    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(screen.getByText('0/1')).toBeInTheDocument();
    expect(screen.getAllByText('ثلاثة').length).toBeGreaterThan(0);
  });

  it('reverses the other way for a feminine noun', async () => {
    const user = userEvent.setup();
    startWith([magazine]);
    await user.click(screen.getByText('1–2'));
    await user.click(screen.getByText('11–99'));
    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(screen.getByText('feminine')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/The number, in words/i), 'ثلاث');
    await user.type(screen.getByLabelText(/The noun/i), 'مجلات');
    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(screen.getByText('1/1')).toBeInTheDocument();
  });

  it('gives the noun a hover panel with its definition and tags', async () => {
    const user = userEvent.setup();
    startWith([book]);
    await user.click(screen.getByText('1–2'));
    await user.click(screen.getByText('11–99'));
    await user.click(screen.getByRole('button', { name: 'Start' }));

    // The word sits inside the popover's trigger, so hover the trigger itself
    // rather than the span holding the text.
    const trigger = screen.getByText('كِتاب').closest('[aria-haspopup]');
    await user.hover(trigger as Element);
    expect(await screen.findByText('ك-ت-ب')).toBeInTheDocument();
    expect(screen.getByText('كُتُب')).toBeInTheDocument();
  });
});
