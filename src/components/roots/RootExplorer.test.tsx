import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RootExplorer from './RootExplorer';
import type { FlashCard } from '@/lib/spaced-repetition';

vi.mock('@/lib/morphology', async (orig) => ({
  ...(await orig<typeof import('@/lib/morphology')>()),
  loadRootMeanings: () => Promise.resolve({ 'ك-ت-ب': 'writing' }),
}));
vi.mock('@/lib/dictionary', async (orig) => ({
  ...(await orig<typeof import('@/lib/dictionary')>()),
  entriesForRoots: () => Promise.resolve([]),
}));
vi.mock('@/contexts/DeckActionsContext', () => ({ useDeckActions: () => ({ addWord: undefined }) }));

function card(over: Partial<FlashCard> & { id: string; word: string }): FlashCard {
  return {
    english: null, imageUrl: null, nextReviewDate: '2026-01-01', intervalDays: 1, easeFactor: 2.5,
    learningStage: 'graduated', stage1Attempts: 0, stage2Attempts: 0, ...over,
  } as FlashCard;
}

const cards = [
  card({ id: '1', word: 'كتب', wordVoweled: 'كَتَبَ', english: 'to write', root: 'ك-ت-ب', wordType: 'verb', verbForm: 'I' }),
  card({ id: '2', word: 'كتاب', wordVoweled: 'كِتاب', english: 'book', root: 'ك-ت-ب', wordType: 'noun' }),
  card({ id: '3', word: 'بيت', english: 'house', root: null, wordType: 'noun' }),
];

describe('RootExplorer', () => {
  it('lists roots, then opens a tree of the words built on one', async () => {
    render(<RootExplorer cards={cards} onBack={() => {}} />);
    expect(screen.getByText(/1 root across your deck/)).toBeInTheDocument();
    expect(screen.getByText(/1 word has no root recorded/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('ك-ت-ب'));
    expect(await screen.findByText('2 words in your deck')).toBeInTheDocument();
    expect(screen.getByText('book')).toBeInTheDocument();
    expect(screen.getByText('to write')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Form I, in your deck/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Form II, not seen/ })).toBeInTheDocument();
  });

  it('says so when no root matches the search', () => {
    render(<RootExplorer cards={cards} onBack={() => {}} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
    expect(screen.getByText(/No root matches/)).toBeInTheDocument();
  });
});
