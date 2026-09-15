import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddWordButton from './AddWordButton';
import { DeckContext } from '@/contexts/DeckContext';
import { DeckActionsContext } from '@/contexts/DeckActionsContext';
import type { FlashCard } from '@/lib/spaced-repetition';

const word = { word: 'خِدمة', english: 'service', root: 'خ-د-م', wordType: 'noun' };

function draw({
  deck = [] as FlashCard[],
  addWord,
}: { deck?: FlashCard[]; addWord?: (w: typeof word) => Promise<void> } = {}) {
  render(
    <DeckContext.Provider value={deck}>
      <DeckActionsContext.Provider value={{ addWord }}>
        <AddWordButton word={word} />
      </DeckActionsContext.Provider>
    </DeckContext.Provider>,
  );
}

describe('AddWordButton', () => {
  it('sends the word to the deck when pressed', async () => {
    const user = userEvent.setup();
    const addWord = vi.fn(async () => {});
    draw({ addWord });

    await user.click(screen.getByRole('button', { name: 'Add to my cards' }));
    expect(addWord).toHaveBeenCalledWith(word);
    // And says so, rather than leaving the button looking unpressed.
    expect(await screen.findByText('In your cards')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add to my cards' })).toBeNull();
  });

  it('says the word is already known rather than offering to add it twice', () => {
    draw({
      addWord: vi.fn(async () => {}),
      deck: [{ id: '1', word: 'خدمة', english: 'service' } as FlashCard],
    });
    // Matched without diacritics, so the voweled reading counts as the same word.
    expect(screen.getByText('In your cards')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add to my cards' })).toBeNull();
  });

  it('offers the action again when the save failed', async () => {
    const user = userEvent.setup();
    const addWord = vi.fn(async () => {
      throw new Error('offline');
    });
    draw({ addWord });

    await user.click(screen.getByRole('button', { name: 'Add to my cards' }));
    // Nothing was saved, so claiming it was would be a lie the reader acts on.
    expect(await screen.findByRole('button', { name: 'Add to my cards' })).toBeEnabled();
    expect(screen.queryByText('In your cards')).toBeNull();
  });

  it('renders nothing where there is no deck to add to', () => {
    render(<AddWordButton word={word} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
