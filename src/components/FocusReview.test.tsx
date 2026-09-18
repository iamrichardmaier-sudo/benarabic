import { describe, it, expect, vi, beforeEach } from 'vitest';

// The detail panel reaches for the tagged corpus; this screen is not about
// the network.
vi.mock('@/lib/bible-root-index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bible-root-index')>();
  return { ...actual, fetchWordsByRoot: vi.fn(async () => []) };
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FocusReview from './FocusReview';
import { createCard, type FlashCard } from '@/lib/spaced-repetition';

function card(over: Partial<FlashCard> = {}): FlashCard {
  return {
    ...createCard('خِدمة', 'service'),
    wordVoweled: 'خِدْمة',
    root: 'خ-د-م',
    ...over,
  };
}

function show(props: Partial<React.ComponentProps<typeof FocusReview>> = {}) {
  const onRate = vi.fn();
  const onExit = vi.fn();
  render(
    <FocusReview
      card={card()}
      onRate={onRate}
      onExit={onExit}
      progress={{ current: 1, total: 4 }}
      {...props}
    />,
  );
  return { onRate, onExit };
}

beforeEach(() => {
  // Speech is not what these tests are about, and jsdom has none of it —
  // neither the synthesiser nor the utterance constructor it is handed.
  Object.defineProperty(window, 'speechSynthesis', {
    writable: true,
    value: { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [] },
  });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    writable: true,
    value: class { constructor(public text: string) {} },
  });
  globalThis.SpeechSynthesisUtterance = window.SpeechSynthesisUtterance;
});

describe('FocusReview', () => {
  it('starts face down, with the answer hidden', async () => {
    show();
    expect(screen.getByText('→ to flip')).toBeInTheDocument();
    expect(screen.queryByText('service')).not.toBeInTheDocument();
  });

  it('turns the card over on the right arrow', async () => {
    show();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByText('service')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Again' })).toBeEnabled();
  });

  it('grades easy on a second right arrow, not on the first', async () => {
    const { onRate } = show();
    await userEvent.keyboard('{ArrowRight}');
    expect(onRate).not.toHaveBeenCalled();
    await userEvent.keyboard('{ArrowRight}');
    expect(onRate).toHaveBeenCalledWith('easy');
  });

  it('grades again on the left arrow once the answer is showing', async () => {
    const { onRate } = show();
    await userEvent.keyboard('{ArrowRight}{ArrowLeft}');
    expect(onRate).toHaveBeenCalledWith('again');
  });

  it('refuses to grade a card that has not been turned over', async () => {
    const { onRate } = show();
    await userEvent.keyboard('{ArrowLeft}{ArrowUp}{ArrowDown}');
    expect(onRate).not.toHaveBeenCalled();
  });

  it('leaves on Escape', async () => {
    const { onExit } = show();
    await userEvent.keyboard('{Escape}');
    expect(onExit).toHaveBeenCalled();
  });

  it('will not grade with the mouse before the card is turned over either', async () => {
    const { onRate } = show();
    await userEvent.click(screen.getByRole('button', { name: 'Easy' }));
    expect(onRate).not.toHaveBeenCalled();
  });

  it('grades with the mouse once it is', async () => {
    const { onRate } = show();
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.click(screen.getByRole('button', { name: 'Easy' }));
    expect(onRate).toHaveBeenCalledWith('easy');
  });

  it('turns the next card face down again', async () => {
    const { rerender } = render(
      <FocusReview
        card={card({ id: 'one' })}
        onRate={vi.fn()}
        onExit={vi.fn()}
        progress={{ current: 1, total: 2 }}
      />,
    ) as unknown as { rerender: (ui: React.ReactElement) => void };
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByText('service')).toBeInTheDocument();

    rerender(
      <FocusReview
        card={card({ id: 'two', english: 'work' })}
        onRate={vi.fn()}
        onExit={vi.fn()}
        progress={{ current: 2, total: 2 }}
      />,
    );
    // The new card must arrive hidden, or one arrow press grades it unseen.
    expect(screen.getByText('→ to flip')).toBeInTheDocument();
    expect(screen.queryByText('work')).not.toBeInTheDocument();
  });

  it('says it is a practice run when it is one', async () => {
    show({ practising: true });
    expect(screen.getByText(/nothing is rescheduled/)).toBeInTheDocument();
  });
});
