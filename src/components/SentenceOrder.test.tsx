import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SentenceOrder from './SentenceOrder';
import { createCard } from '@/lib/spaced-repetition';

const card = {
  ...createCard('قَدّيش بِدَّك تِبقى بِأَمريكا؟', 'How long do you want to stay in the United States?'),
  wordType: 'sentence' as const,
};
const words = ['قَدّيش', 'بِدَّك', 'تِبقى', 'بِأَمريكا'];

/** The word bank's tile for a word (the placed copy lives in the answer row). */
const bank = (w: string) => within(screen.getByLabelText('Word bank')).getByRole('button', { name: w });

async function placeAll(user: ReturnType<typeof userEvent.setup>, order: string[]) {
  for (const w of order) await user.click(bank(w));
}

describe('SentenceOrder', () => {
  it('asks the English question and offers every word as a tile', () => {
    render(<SentenceOrder card={card} onDone={() => {}} />);
    expect(screen.getByText(card.english!)).toBeInTheDocument();
    for (const w of words) expect(bank(w)).toBeEnabled();
  });

  it('will not check until every word is placed', async () => {
    const user = userEvent.setup();
    render(<SentenceOrder card={card} onDone={() => {}} />);
    const check = screen.getByRole('button', { name: 'Check' });
    expect(check).toBeDisabled();
    await placeAll(user, words.slice(0, 3));
    expect(check).toBeDisabled();
    await user.click(bank(words[3]));
    expect(check).toBeEnabled();
  });

  it('lets a placed word be taken back, and Clear empties the row', async () => {
    const user = userEvent.setup();
    render(<SentenceOrder card={card} onDone={() => {}} />);
    await placeAll(user, words.slice(0, 2));
    const row = screen.getByLabelText('Your sentence');
    await user.click(within(row).getByRole('button', { name: words[0] }));
    expect(within(row).queryByRole('button', { name: words[0] })).not.toBeInTheDocument();
    expect(bank(words[0])).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(within(row).queryAllByRole('button')).toHaveLength(0);
  });

  it('passes on a correct order after one round', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<SentenceOrder card={card} onDone={onDone} />);
    await placeAll(user, words);
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('Correct!')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onDone).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('on a miss shows the sentence and reports failure', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<SentenceOrder card={card} onDone={onDone} />);
    await placeAll(user, [words[1], words[0], words[2], words[3]]);
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(card.word)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onDone).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('needs every round to pass when rounds is two', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<SentenceOrder card={card} rounds={2} onDone={onDone} />);
    expect(screen.getByText('Round 1 of 2')).toBeInTheDocument();

    await placeAll(user, words);
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(screen.getByRole('button', { name: 'Next round' }));
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByText('Round 2 of 2')).toBeInTheDocument();

    await placeAll(user, words);
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onDone).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('a miss in the second round fails the card', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<SentenceOrder card={card} rounds={2} onDone={onDone} />);
    await placeAll(user, words);
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(screen.getByRole('button', { name: 'Next round' }));
    await placeAll(user, [words[3], words[2], words[1], words[0]]);
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onDone).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('has a slider that joins neighbouring words into bigger chunks, down to two', async () => {
    localStorage.removeItem('wazn-sentence-pieces');
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<SentenceOrder card={card} onDone={onDone} />);
    const slider = screen.getByRole('slider', { name: 'Chunk size' });
    expect(slider).toHaveAttribute('aria-valuetext', 'Every word');
    slider.focus();
    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    expect(slider).toHaveAttribute('aria-valuenow', '2');
    const tiles = within(screen.getByLabelText('Word bank')).getAllByRole('button');
    expect(tiles).toHaveLength(2);
    // Two chunks of two words, placed in order.
    await user.click(within(screen.getByLabelText('Word bank')).getByRole('button', { name: `${words[0]} ${words[1]}` }));
    await user.click(within(screen.getByLabelText('Word bank')).getByRole('button', { name: `${words[2]} ${words[3]}` }));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('Correct!')).toBeInTheDocument();
    // The choice is kept for the next sentence.
    expect(localStorage.getItem('wazn-sentence-pieces')).toBe('2');
    localStorage.removeItem('wazn-sentence-pieces');
  });
});
