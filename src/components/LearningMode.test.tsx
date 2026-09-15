import { describe, it, expect, vi, beforeEach } from 'vitest';

// The detail panel looks other words on the root up in the tagged corpus.
// Served locally so these tests are about the screen, not the network.
vi.mock('@/lib/bible-root-index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bible-root-index')>();
  return {
    ...actual,
    // A word genuinely distinct from the card and its family: WordDetail drops
    // anything already named above it, which is the point of the list.
    fetchWordsByRoot: vi.fn(async () => [
      { surface: 'الْخُدّامُ', lemma: 'خُدّام', root: 'خ-د-م', gloss: 'the servants' },
    ]),
  };
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LearningMode from './LearningMode';
import { createCard, type FlashCard } from '@/lib/spaced-repetition';

/** The card from the widget screenshot: richly tagged, so every section fills. */
function service(over: Partial<FlashCard> = {}): FlashCard {
  return {
    ...createCard('خِدمة', 'service'),
    learningStage: 'stage2',
    root: 'خ-د-م',
    wordType: 'noun',
    fushaPlural: 'خَدَمات',
    shaami: 'خِدمة',
    companionForms: [
      { form: 'خَدَمَ', label: 'Form I verb (to serve)' },
      { form: 'خادِم', label: 'Active participle (servant)' },
    ],
    ...over,
  };
}

/** Another card on the same root, so "same root in your deck" has something. */
const sibling: FlashCard = {
  ...createCard('يَخدِم', 'to serve'),
  learningStage: 'graduated',
  root: 'خ-د-م',
  wordType: 'verb',
};

function draw(card: FlashCard) {
  const onUpdateCard = vi.fn();
  render(
    <LearningMode
      cards={[card]}
      allCards={[card, sibling]}
      onUpdateCard={onUpdateCard}
      onBack={() => {}}
    />,
  );
  return { onUpdateCard };
}

beforeEach(() => {
  localStorage.clear();
});

describe('the answer screen while learning a new card', () => {
  it('shows what the word is made of once the answer is in', async () => {
    const user = userEvent.setup();
    draw(service());

    // Nothing is given away before the answer is committed.
    expect(screen.queryByText('Word family')).toBeNull();

    await user.type(screen.getByRole('textbox'), 'خِدمة{Enter}');

    expect(await screen.findByText('Perfect!')).toBeInTheDocument();
    expect(screen.getByText('Its other forms')).toBeInTheDocument();
    expect(screen.getByText('Word family')).toBeInTheDocument();
    expect(screen.getByText('Same root in your deck')).toBeInTheDocument();
    // The root and part of speech, the way the widget heads the panel.
    expect(screen.getByText('خ-د-م')).toBeInTheDocument();
    expect(screen.getByText('Noun')).toBeInTheDocument();
    // Its own forms and its family, by name.
    expect(screen.getByText('خَدَمات')).toBeInTheDocument();
    expect(screen.getByText('Active participle (servant)')).toBeInTheDocument();
    // And the other word on this root that's already in the deck.
    expect(screen.getByText('يَخدِم')).toBeInTheDocument();
  });

  it('pulls in the words on the same root from scripture', async () => {
    const user = userEvent.setup();
    draw(service());
    await user.type(screen.getByRole('textbox'), 'خِدمة{Enter}');
    await waitFor(() => expect(screen.getByText('Same root in scripture')).toBeInTheDocument());
    expect(screen.getByText('خُدّام')).toBeInTheDocument();
    expect(screen.getByText('the servants')).toBeInTheDocument();
  });

  it('shows it after a wrong answer too, which is when it is most wanted', async () => {
    const user = userEvent.setup();
    draw(service());
    await user.type(screen.getByRole('textbox'), 'غلط{Enter}');
    // A near-miss asks whether it was close enough; the panel is there either way.
    expect(await screen.findByText('Its other forms')).toBeInTheDocument();
    expect(screen.getByText('Word family')).toBeInTheDocument();
  });

  it('moves on when Enter is pressed on the answer screen', async () => {
    const user = userEvent.setup();
    draw(service());
    await user.type(screen.getByRole('textbox'), 'خِدمة{Enter}');
    expect(await screen.findByText('Perfect!')).toBeInTheDocument();

    // The Enter that submitted must not also skip the screen it just opened.
    expect(screen.getByText('Its other forms')).toBeInTheDocument();

    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.queryByText('Perfect!')).toBeNull());
  });

  it('leaves a bare card bare rather than framing an empty panel', async () => {
    const user = userEvent.setup();
    const bare = {
      ...createCard('شَيء', 'thing'),
      learningStage: 'stage2' as const,
    };
    render(
      <LearningMode cards={[bare]} allCards={[bare]} onUpdateCard={vi.fn()} onBack={() => {}} />,
    );
    await user.type(screen.getByRole('textbox'), 'شَيء{Enter}');
    expect(await screen.findByText('Perfect!')).toBeInTheDocument();
    expect(screen.queryByText('Its other forms')).toBeNull();
    expect(screen.queryByText('Word family')).toBeNull();
  });
});
