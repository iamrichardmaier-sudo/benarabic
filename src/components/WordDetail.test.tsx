import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WordDetail from './WordDetail';
import type { FlashCard } from '@/lib/spaced-repetition';

function card(extra: Partial<FlashCard> = {}): FlashCard {
  return {
    id: 'c1',
    word: 'كتاب',
    wordVoweled: 'كِتاب',
    english: 'book',
    root: 'ك-ت-ب',
    fushaPlural: 'كُتُب',
    ...extra,
  } as FlashCard;
}

const verse = {
  quranExample: 'ذَٰلِكَ الْكِتَابُ لَا رَيْبَ فِيهِ',
  quranExampleEn: 'This is the Book about which there is no doubt.',
  quranReference: 'Al-Baqarah 2:2',
};

describe('WordDetail — Quranic reference', () => {
  it('shows the verse, its translation and its reference', () => {
    render(<WordDetail card={card(verse)} />);
    expect(screen.getByText('Quranic reference')).toBeInTheDocument();
    expect(screen.getByText(verse.quranExample)).toBeInTheDocument();
    expect(screen.getByText(verse.quranExampleEn)).toBeInTheDocument();
    expect(screen.getByText(verse.quranReference)).toBeInTheDocument();
  });

  it('is the last section on the card', () => {
    render(<WordDetail card={card(verse)} />);
    const headings = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent);
    expect(headings[headings.length - 1]).toBe('Quranic reference');
  });

  it('leaves the section out when the word has no verse, or was skipped', () => {
    const { rerender } = render(<WordDetail card={card()} />);
    expect(screen.queryByText('Quranic reference')).not.toBeInTheDocument();
    // A skipped word is stored as an empty string and must read as absent.
    rerender(<WordDetail card={card({ quranExample: '' })} />);
    expect(screen.queryByText('Quranic reference')).not.toBeInTheDocument();
  });
});
