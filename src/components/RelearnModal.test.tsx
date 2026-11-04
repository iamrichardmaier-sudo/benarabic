import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RelearnModal from './RelearnModal';
import { createCard, type FlashCard } from '@/lib/spaced-repetition';

const word = (w: string, en: string): FlashCard => ({ ...createCard(w, en), wordType: 'noun' });
const sentence = (w: string, en: string): FlashCard => ({ ...createCard(w, en), wordType: 'sentence' });

const deck = [
  word('بيت', 'house'),
  sentence('قَدّيش بِدَّك تِبقى بِأَمريكا؟', 'How long do you want to stay?'),
  word('كتاب', 'book'),
  sentence('وين كُنت بِتروح؟', 'Where would you go?'),
];

describe('RelearnModal sentences button', () => {
  it('is absent when the deck has no sentences', () => {
    render(<RelearnModal cards={[deck[0], deck[2]]} onClose={() => {}} onStartRelearn={() => {}} />);
    expect(screen.queryByRole('button', { name: /Sentences/ })).not.toBeInTheDocument();
  });

  it('shows only the sentences and selects them all', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<RelearnModal cards={deck} onClose={() => {}} onStartRelearn={onStart} />);

    await user.click(screen.getByRole('button', { name: 'Sentences (2)' }));
    expect(screen.getByText('How long do you want to stay?')).toBeInTheDocument();
    expect(screen.queryByText('house')).not.toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    for (const box of screen.getAllByRole('checkbox')) expect(box).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Start Relearning (2 cards)' }));
    expect(onStart.mock.calls[0][0].sort()).toEqual([deck[1].id, deck[3].id].sort());
  });

  it('goes back to the whole deck and keeps the selection', async () => {
    const user = userEvent.setup();
    render(<RelearnModal cards={deck} onClose={() => {}} onStartRelearn={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Sentences (2)' }));
    await user.click(screen.getByRole('button', { name: /show all/ }));
    expect(screen.getByText('house')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Relearning (2 cards)' })).toBeEnabled();
  });

  it('Select All acts on what is listed', async () => {
    const user = userEvent.setup();
    render(<RelearnModal cards={deck} onClose={() => {}} onStartRelearn={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Sentences (2)' }));
    await user.click(screen.getByRole('button', { name: 'Deselect All' }));
    expect(screen.getByRole('button', { name: 'Start Relearning (0 cards)' })).toBeDisabled();
  });
});

describe('RelearnModal by deck', () => {
  const home = [{ ...word('بيت', 'house'), wordId: 'w1' }, { ...word('كتاب', 'book'), wordId: 'w2' }];
  const trip = [{ ...word('سفر', 'travel'), wordId: 'w3' }];
  const typed = word('شمس', 'sun'); // no wordId: in no deck
  const cards = [...home, ...trip, typed];
  const decks = [
    { id: 'd1', title: 'Home', wordIds: new Set(['w1', 'w2']) },
    { id: 'd2', title: 'Travel', wordIds: new Set(['w3']) },
  ];

  it('lists each deck folded, with its card count, and what is in none', () => {
    render(<RelearnModal cards={cards} decks={decks} onClose={() => {}} onStartRelearn={() => {}} />);
    expect(screen.getByRole('button', { name: 'Home, 2 cards' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Travel, 1 card' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not in a deck, 1 card' })).toBeInTheDocument();
    expect(screen.queryByText('house')).not.toBeInTheDocument();
  });

  it('opens a deck to show its cards', async () => {
    const user = userEvent.setup();
    render(<RelearnModal cards={cards} decks={decks} onClose={() => {}} onStartRelearn={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Home, 2 cards' }));
    expect(screen.getByText('house')).toBeInTheDocument();
    expect(screen.getByText('book')).toBeInTheDocument();
    expect(screen.queryByText('travel')).not.toBeInTheDocument();
  });

  it('selects a whole deck without opening it, and starts with just those cards', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<RelearnModal cards={cards} decks={decks} onClose={() => {}} onStartRelearn={onStart} />);
    await user.click(screen.getByRole('button', { name: 'Select Home' }));
    await user.click(screen.getByRole('button', { name: 'Start Relearning (2 cards)' }));
    expect(onStart.mock.calls[0][0].sort()).toEqual([home[0].id, home[1].id].sort());
  });

  it('does not fold a single deck', () => {
    render(<RelearnModal cards={home} decks={[decks[0]]} onClose={() => {}} onStartRelearn={() => {}} />);
    expect(screen.getByText('house')).toBeInTheDocument();
  });

  it('falls back to the plain list when the decks could not be loaded', () => {
    render(<RelearnModal cards={cards} decks={null} onClose={() => {}} onStartRelearn={() => {}} />);
    expect(screen.getByText('house')).toBeInTheDocument();
  });
});
