import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The podcast shelf fetches a manifest; this screen's tests are not about it.
vi.mock('@/components/podcasts/PodcastShelf', () => ({ default: () => null }));

import LearnHub from './LearnHub';

const base = { dueCount: 0, deckSize: 10, onSelect: () => {}, onOpenPodcast: () => {} };

describe('LearnHub vocab / sentences choice', () => {
  it('summarises words and sentences and offers the choice', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <LearnHub {...base} learnCount={5} wordsWaiting={3} sentencesWaiting={2}
        cardMix="both" onCardMixChange={onChange} />,
    );
    expect(screen.getByText('3 words · 2 sentences waiting')).toBeInTheDocument();
    const picker = screen.getByRole('radiogroup', { name: 'Cards to study' });
    expect(screen.getByRole('radio', { name: 'Both' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: 'Sentences' }));
    expect(onChange).toHaveBeenCalledWith('sentences');
    await user.click(screen.getByRole('radio', { name: 'Vocab' }));
    expect(onChange).toHaveBeenCalledWith('words');
    expect(picker).toBeInTheDocument();
  });

  it('counts just the sentences while sentences are picked', () => {
    render(
      <LearnHub {...base} learnCount={2} wordsWaiting={3} sentencesWaiting={2}
        cardMix="sentences" onCardMixChange={() => {}} />,
    );
    expect(screen.getByText('2 sentences waiting')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Sentences' })).toHaveAttribute('aria-checked', 'true');
  });

  it('counts just the vocab while vocab is picked', () => {
    render(
      <LearnHub {...base} learnCount={3} wordsWaiting={3} sentencesWaiting={2}
        cardMix="words" onCardMixChange={() => {}} />,
    );
    expect(screen.getByText('3 words waiting')).toBeInTheDocument();
  });

  it('says what Review holds for the chosen kind', () => {
    render(
      <LearnHub {...base} dueCount={7} dueSplit={{ words: 5, sentences: 2 }} learnCount={0}
        cardMix="sentences" onCardMixChange={() => {}} />,
    );
    expect(screen.getByText('2 sentences due · 7 in all')).toBeInTheDocument();
  });

  it('keeps the choice reachable when it is set and nothing is waiting', () => {
    render(
      <LearnHub {...base} learnCount={0} sentencesWaiting={0}
        cardMix="sentences" onCardMixChange={() => {}} />,
    );
    expect(screen.getByText('No sentences waiting')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Cards to study' })).toBeInTheDocument();
  });

  it('hides the choice when there are no sentences', () => {
    render(<LearnHub {...base} learnCount={4} wordsWaiting={4} onCardMixChange={() => {}} />);
    expect(screen.getByText('4 waiting')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });
});
