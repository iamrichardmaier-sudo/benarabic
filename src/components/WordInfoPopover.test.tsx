import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WordInfoPopover from './WordInfoPopover';
import { DeckContext } from '@/contexts/DeckContext';
import type { FlashCard } from '@/lib/spaced-repetition';

const card = (o: Partial<FlashCard>): FlashCard => ({
  id: 'x', word: 'كتاب', english: null, imageUrl: null,
  nextReviewDate: '2026-01-01', intervalDays: 1, easeFactor: 2.5,
  learningStage: 'graduated', stage1Attempts: 0, stage2Attempts: 0,
  ...o,
}) as FlashCard;

const kitaab = card({
  word: 'كتاب', wordVoweled: 'كِتاب', english: 'book',
  root: 'ك-ت-ب', wordType: 'noun', fushaPlural: 'كُتُب',
  companionForms: [{ form: 'كاتِب', label: 'Active participle' }],
});

describe('WordInfoPopover', () => {
  it('shows the definition, which the hand-made panel never did', async () => {
    const user = userEvent.setup();
    render(<WordInfoPopover card={kitaab}>كِتاب</WordInfoPopover>);
    await user.click(screen.getByText('كِتاب'));
    expect(await screen.findByText('book')).toBeInTheDocument();
  });

  it('shows the root and type, the way the card does', async () => {
    const user = userEvent.setup();
    render(<WordInfoPopover card={kitaab}>كِتاب</WordInfoPopover>);
    await user.click(screen.getByText('كِتاب'));
    expect(await screen.findByText('ك-ت-ب')).toBeInTheDocument();
    expect(screen.getByText('Noun')).toBeInTheDocument();
  });

  it('still shows the forms and companions it always showed', async () => {
    const user = userEvent.setup();
    render(<WordInfoPopover card={kitaab}>كِتاب</WordInfoPopover>);
    await user.click(screen.getByText('كِتاب'));
    expect(await screen.findByText('كُتُب')).toBeInTheDocument();
    expect(screen.getByText('كاتِب')).toBeInTheDocument();
    expect(screen.getByText('Active participle')).toBeInTheDocument();
  });

  it('shows what the deck already holds on the root', async () => {
    const user = userEvent.setup();
    render(
      <DeckContext.Provider
        value={[card({ id: 'o', word: 'مكتب', wordVoweled: 'مَكتَب', english: 'office', root: 'ك-ت-ب' })]}
      >
        <WordInfoPopover card={kitaab}>كِتاب</WordInfoPopover>
      </DeckContext.Provider>,
    );
    await user.click(screen.getByText('كِتاب'));
    expect(await screen.findByText('Same root in your deck')).toBeInTheDocument();
    expect(screen.getByText('office')).toBeInTheDocument();
  });

  it('does not wrap a word that has nothing to say', () => {
    const bare = card({ word: 'كَذلِكَ', english: null });
    render(<WordInfoPopover card={bare}>كَذلِكَ</WordInfoPopover>);
    // No trigger styling, so nothing invites a hover that would show nothing.
    expect(screen.getByText('كَذلِكَ').className).toBe('');
  });

  it('opens on a tap as well as a hover', async () => {
    // Both this component and Radix used to toggle, and a pointer enters
    // before it clicks, so a tap opened the panel and shut it again in one
    // gesture — on a phone it never appeared at all.
    const user = userEvent.setup();
    render(<WordInfoPopover card={kitaab}>كِتاب</WordInfoPopover>);
    await user.click(screen.getByText('كِتاب'));
    expect(await screen.findByText('book')).toBeInTheDocument();
  });

  it('keeps the click off whatever sits underneath', async () => {
    // On a flashcard the word sits on the card face; opening the panel must
    // not also flip the card.
    const user = userEvent.setup();
    let flipped = false;
    render(
      <div onClick={() => { flipped = true; }}>
        <WordInfoPopover card={kitaab}>كِتاب</WordInfoPopover>
      </div>,
    );
    await user.click(screen.getByText('كِتاب'));
    expect(flipped).toBe(false);
  });
});
