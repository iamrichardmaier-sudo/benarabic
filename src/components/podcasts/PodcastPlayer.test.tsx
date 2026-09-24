import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PodcastPlayer from './PodcastPlayer';
import type { Podcast } from '@/lib/podcasts';

// jsdom's HTMLMediaElement has no real playback: play() returns undefined
// rather than a promise, which breaks the hook's `.catch`. Stubbed the same
// way most RTL suites handle it, so these tests are about PodcastPlayer's
// own logic rather than about jsdom's audio gap.
beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  window.HTMLMediaElement.prototype.load = vi.fn();
});

function pod(over: Partial<Podcast> = {}): Podcast {
  return {
    id: 'p1',
    title: 'II Chapter 1 podcast',
    subtitle: 'Call and response on all 52 words',
    deckId: null,
    icon: 'mihrab',
    iconUrl: null,
    shaamiUrl: 'https://example.test/sh.mp3',
    fushaUrl: 'https://example.test/fu.mp3',
    shaamiSeconds: 1498,
    fushaSeconds: 1577,
    ...over,
  };
}

describe('PodcastPlayer', () => {
  it('shows the register picker before anything is asked to play', () => {
    render(<PodcastPlayer podcast={pod()} onBack={vi.fn()} />);
    expect(screen.getByText('Listen in')).toBeInTheDocument();
    expect(screen.getByText('Shaami')).toBeInTheDocument();
    expect(screen.getByText('Fuṣḥā')).toBeInTheDocument();
    expect(screen.getByText('Both, back to back')).toBeInTheDocument();
  });

  it('a deep link with a register skips the picker and starts that register', () => {
    // This is the whole point of the widget's &register= link: one tap from
    // the home screen lands on sound already playing, not on a menu.
    render(<PodcastPlayer podcast={pod()} onBack={vi.fn()} initialRegister="fusha" />);
    expect(screen.queryByText('Listen in')).not.toBeInTheDocument();
    expect(screen.getByText('Fuṣḥā', { selector: 'p' })).toBeInTheDocument();
  });

  it('a deep link asking for both queues Shaami first', () => {
    render(<PodcastPlayer podcast={pod()} onBack={vi.fn()} initialRegister="both" />);
    expect(screen.getByText(/part 1 of 2/)).toBeInTheDocument();
  });

  it('falls back to the picker rather than crashing on a register with no audio', () => {
    render(
      <PodcastPlayer
        podcast={pod({ fushaUrl: null })}
        onBack={vi.fn()}
        initialRegister="fusha"
      />,
    );
    expect(screen.getByText('Listen in')).toBeInTheDocument();
    // Only the register that actually has audio is offered.
    expect(screen.queryByText('Fuṣḥā')).not.toBeInTheDocument();
  });
});
