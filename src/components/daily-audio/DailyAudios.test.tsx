import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { DailyAudio } from '@/hooks/useDailyAudios';

const hook = vi.hoisted(() => ({
  value: { episodes: [] as DailyAudio[], loading: false, error: null as string | null },
}));
vi.mock('@/hooks/useDailyAudios', () => ({ useDailyAudios: () => hook.value }));

const player = vi.hoisted(() => ({
  start: vi.fn(),
  toggle: vi.fn(),
  tracks: [] as { url: string; label: string }[],
  state: { playing: false, index: 0, position: 0, duration: 0, offset: 0, loading: false, error: null as string | null },
}));
vi.mock('@/hooks/usePodcastPlayer', () => ({
  usePodcastPlayer: () => ({ state: player.state, tracks: player.tracks, start: player.start, toggle: player.toggle }),
}));

import DailyAudios from './DailyAudios';
import { formatDuration, formatEpisodeDate } from '@/lib/daily-audio';

const episode = (over: Partial<DailyAudio> = {}): DailyAudio => ({
  id: 'e1',
  audioDate: '2026-10-08',
  title: 'Oct 8 — At the Clothing Shop',
  audioUrl: 'https://x/daily-audio/2026-10-08.mp3',
  imageUrl: 'https://x/daily-audio-art/2026-10-08.png',
  durationSecs: 754,
  ...over,
});

beforeEach(() => {
  hook.value = { episodes: [], loading: false, error: null };
  player.start.mockReset();
  player.toggle.mockReset();
  player.tracks = [];
  player.state = { playing: false, index: 0, position: 0, duration: 0, offset: 0, loading: false, error: null };
});

describe('formatting', () => {
  it('formats seconds as m:ss', () => {
    expect(formatDuration(754)).toBe('12:34');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(0)).toBe('0:00');
  });

  it('formats a day without shifting it across a timezone', () => {
    expect(formatEpisodeDate('2026-10-08')).toMatch(/8/);
    expect(formatEpisodeDate('2026-10-08')).toMatch(/Oct/);
  });
});

describe('DailyAudios', () => {
  it('keeps the section and says when the first episode arrives', () => {
    render(<DailyAudios />);
    expect(screen.getByText('Daily Audios')).toBeInTheDocument();
    expect(screen.getByText('Your first daily audio arrives tomorrow at 4 AM.')).toBeInTheDocument();
  });

  it('shows skeletons while loading', () => {
    hook.value = { episodes: [], loading: true, error: null };
    const { container } = render(<DailyAudios />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.queryByText(/first daily audio/)).not.toBeInTheDocument();
  });

  it('lists episodes with title, date, duration and cover, in the order given', () => {
    hook.value = {
      episodes: [episode(), episode({ id: 'e2', audioDate: '2026-10-07', title: 'Oct 7 — Earlier', durationSecs: null, imageUrl: null })],
      loading: false,
      error: null,
    };
    const { container } = render(<DailyAudios />);
    const rows = screen.getAllByRole('button');
    expect(rows[0]).toHaveAccessibleName('Play Oct 8 — At the Clothing Shop');
    expect(rows[1]).toHaveAccessibleName('Play Oct 7 — Earlier');
    expect(screen.getByText(/12:34/)).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://x/daily-audio-art/2026-10-08.png');
    // The second has no cover, so it falls back to the icon tile.
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });

  it('starts an episode through the shared player with its URL and title', () => {
    hook.value = { episodes: [episode()], loading: false, error: null };
    render(<DailyAudios />);
    fireEvent.click(screen.getByRole('button'));
    expect(player.start).toHaveBeenCalledWith([
      { url: 'https://x/daily-audio/2026-10-08.mp3', label: 'Oct 8 — At the Clothing Shop' },
    ]);
  });

  it('toggles the active episode and shows playing state and progress', () => {
    hook.value = { episodes: [episode()], loading: false, error: null };
    player.tracks = [{ url: 'https://x/daily-audio/2026-10-08.mp3', label: 'x' }];
    player.state = { ...player.state, playing: true, position: 30, duration: 120 };
    render(<DailyAudios />);

    expect(screen.getByText(/Playing/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');

    fireEvent.click(screen.getByRole('button'));
    expect(player.toggle).toHaveBeenCalled();
    expect(player.start).not.toHaveBeenCalled();
  });

  it('says so when the list could not be loaded', () => {
    hook.value = { episodes: [], loading: false, error: 'boom' };
    render(<DailyAudios />);
    expect(screen.getByText('The daily audios could not be loaded.')).toBeInTheDocument();
  });
});
