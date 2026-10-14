import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The podcast shelf fetches a manifest; this screen's tests are not about it.
vi.mock('@/components/podcasts/PodcastShelf', () => ({ default: () => null }));

import LearnHub from './LearnHub';

const base = { dueCount: 0, deckSize: 10, onSelect: () => {}, onOpenPodcast: () => {} };

describe('LearnHub sentences only', () => {
  it('summarises words and sentences and offers the switch', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <LearnHub {...base} learnCount={5} wordsWaiting={3} sentencesWaiting={2}
        sentencesOnly={false} onSentencesOnlyChange={onChange} />,
    );
    expect(screen.getByText('3 words · 2 sentences waiting')).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Sentences only' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('counts just the sentences while the switch is on', () => {
    render(
      <LearnHub {...base} learnCount={2} wordsWaiting={3} sentencesWaiting={2}
        sentencesOnly onSentencesOnlyChange={() => {}} />,
    );
    expect(screen.getByText('2 sentences waiting')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Sentences only' })).toBeChecked();
  });

  it('keeps the switch reachable when it is on and nothing is waiting', () => {
    render(
      <LearnHub {...base} learnCount={0} sentencesWaiting={0}
        sentencesOnly onSentencesOnlyChange={() => {}} />,
    );
    expect(screen.getByText('No sentences waiting')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Sentences only' })).toBeInTheDocument();
  });

  it('hides the switch when there are no sentences', () => {
    render(<LearnHub {...base} learnCount={4} wordsWaiting={4} onSentencesOnlyChange={() => {}} />);
    expect(screen.getByText('4 waiting')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});
