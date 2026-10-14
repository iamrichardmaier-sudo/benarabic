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
