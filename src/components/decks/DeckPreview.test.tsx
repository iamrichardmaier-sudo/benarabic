import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Deck, Word } from '@/lib/deck-store';

const store = vi.hoisted(() => ({ words: [] as Partial<Word>[] }));
vi.mock('@/lib/deck-store', async (orig) => ({
  ...(await orig<typeof import('@/lib/deck-store')>()),
  fetchDeckWords: async () => store.words,
}));
vi.mock('@/contexts/DeckContext', () => ({ useDeck: () => [] }));

import DeckPreview from './DeckPreview';

const deck = { id: 'd1', title: 'Chapter 3', icon: 'book', iconUrl: null, status: 'published' } as unknown as Deck;
const w = (id: string, word: string, wordType: string | null): Partial<Word> => ({
  id, key: id, word, wordVoweled: null, english: id, wordType,
});

beforeEach(() => {
  store.words = [w('w1', 'بيت', 'noun'), w('w2', 'كتب', 'verb'), w('w3', 'قلم', null), w('s1', 'وين كنت', 'sentence')];
});

const renderPreview = (added: boolean, onAdd = vi.fn().mockResolvedValue({ newCards: 1 })) => {
  render(<DeckPreview deck={deck} added={added} onBack={() => {}} onAdd={onAdd} onRemove={() => {}} />);
  return onAdd;
};

describe('DeckPreview — vocab or sentences', () => {
  it('adds the whole deck by default', async () => {
    const onAdd = renderPreview(false);
    await screen.findByRole('radiogroup', { name: 'Cards to add' });
    fireEvent.click(screen.getByRole('button', { name: 'Add this deck' }));
    expect(onAdd).toHaveBeenCalledWith('learn', 'both');
  });

  it('adds just the vocab, or just the sentences, with the counts on the button', async () => {
    const onAdd = renderPreview(false);
    fireEvent.click(await screen.findByRole('radio', { name: /Vocab/ }));
    expect(screen.getByRole('radio', { name: /Vocab/ })).toHaveTextContent('3');
    fireEvent.click(screen.getByRole('button', { name: 'Add 3 words' }));
    expect(onAdd).toHaveBeenLastCalledWith('learn', 'words');

    fireEvent.click(screen.getByRole('radio', { name: /Sentences/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add 1 sentence' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 sentence' }));
    expect(onAdd).toHaveBeenLastCalledWith('learn', 'sentences');
  });

  it('offers no choice for a deck of only one kind', async () => {
    store.words = [w('w1', 'بيت', 'noun')];
    renderPreview(false);
    await screen.findByText('بيت');
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('lets the rest of an added deck be picked up later', async () => {
    const onAdd = renderPreview(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Add more from this deck' }));
    fireEvent.click(screen.getByRole('radio', { name: /Sentences/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 sentence' }));
    expect(onAdd).toHaveBeenCalledWith('learn', 'sentences');
    expect(await screen.findByText('Added 1 card')).toBeInTheDocument();
  });
});
