import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LearningMode from './LearningMode';
import { createCard, type FlashCard } from '@/lib/spaced-repetition';

const words = ['قَدّيش', 'بِدَّك', 'تِبقى', 'بِأَمريكا'];

function sentenceCard(over: Partial<FlashCard> = {}): FlashCard {
  return {
    ...createCard('قَدّيش بِدَّك تِبقى بِأَمريكا؟', 'How long do you want to stay in the United States?'),
    wordType: 'sentence',
    ...over,
  };
}

const bank = (w: string) => within(screen.getByLabelText('Word bank')).getByRole('button', { name: w });

async function order(user: ReturnType<typeof userEvent.setup>, ws: string[]) {
  for (const w of ws) await user.click(bank(w));
  await user.click(screen.getByRole('button', { name: 'Check' }));
}

function draw(cards: FlashCard[], allCards: FlashCard[] = cards) {
  const onUpdateCard = vi.fn();
  render(<LearningMode cards={cards} allCards={allCards} onUpdateCard={onUpdateCard} onBack={() => {}} />);
  return onUpdateCard;
}

describe('LearningMode with a sentence card', () => {
  it('asks for the words in order instead of multiple choice', () => {
    draw([sentenceCard()]);
    expect(screen.getByText(/Round 1 of 2: Put the words in order/)).toBeInTheDocument();
    expect(screen.getByLabelText('Word bank')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('moves a correctly ordered card on to its second round', async () => {
    const user = userEvent.setup();
    const onUpdateCard = draw([sentenceCard()]);
    await order(user, words);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onUpdateCard).toHaveBeenCalledWith(expect.any(String), { stage1Attempts: 1, learningStage: 'stage2' });
  });

  it('keeps a missed card in round one and brings it round again', async () => {
    const user = userEvent.setup();
    const onUpdateCard = draw([sentenceCard()]);
    await order(user, [words[1], words[0], words[2], words[3]]);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onUpdateCard).toHaveBeenCalledWith(expect.any(String), { stage1Attempts: 1, learningStage: 'stage1' });
    // Back again, from the end of the queue.
    expect(screen.getByLabelText('Word bank')).toBeInTheDocument();
    expect(screen.getByText(/Round 1 of 2/)).toBeInTheDocument();
  });

  it('graduates a card that orders correctly in round two', async () => {
    const user = userEvent.setup();
    const onUpdateCard = draw([sentenceCard({ learningStage: 'stage2', stage1Attempts: 1 })]);
    expect(screen.getByText(/Round 2 of 2/)).toBeInTheDocument();
    await order(user, words);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onUpdateCard).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ learningStage: 'graduated', easeFactor: 2.5 }),
    );
  });

  it('never offers a sentence as a multiple-choice answer for a word', () => {
    const sentence = sentenceCard();
    const word = { ...createCard('بيت', 'house'), wordType: 'noun' as const };
    const other = { ...createCard('شجرة', 'tree'), wordType: 'noun' as const };
    draw([word], [word, other, sentence]);
    const offered = screen.getAllByRole('button').map((b) => b.textContent);
    expect(offered).not.toContain(sentence.word);
    expect(offered).not.toContain(sentence.english);
  });
});
