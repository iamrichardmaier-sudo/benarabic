import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const transcripts = [
  { id: 'a', title: 'Chapter 8', subtitle: null, content: 'واحد اثنان ثلاثة', videoUrl: 'videos/lesson-8.mp4', createdAt: '2026-01-01' },
  { id: 'b', title: 'Chapter 13', subtitle: null, content: 'أربعة خمسة ستة', videoUrl: null, createdAt: '2026-01-01' },
];

vi.mock('@/hooks/useTranscripts', () => ({
  useTranscripts: () => ({ transcripts, loading: false, addTranscript: vi.fn(), deleteTranscript: vi.fn(), refetch: vi.fn() }),
}));

import MemorizeTranscript from './MemorizeTranscript';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('MemorizeTranscript video player', () => {
  it('shows a Watch video button for a chapter with a video, hidden until clicked', async () => {
    const user = userEvent.setup();
    render(<MemorizeTranscript />);

    expect(screen.queryByRole('button', { name: /watch video/i })).toBeInTheDocument();
    expect(document.querySelector('video')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /watch video/i }));
    const video = document.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('src', expect.stringContaining('videos/lesson-8.mp4'));
    expect(video).toHaveAttribute('playsinline');

    await user.click(screen.getByRole('button', { name: /hide video/i }));
    expect(document.querySelector('video')).not.toBeInTheDocument();
  });

  it('shows no video button for a chapter with no video', async () => {
    const user = userEvent.setup();
    render(<MemorizeTranscript />);

    await user.click(screen.getByRole('button', { name: 'Chapter 13' }));
    expect(screen.queryByRole('button', { name: /watch video/i })).not.toBeInTheDocument();
  });

  it('closes an open video when switching to a different chapter', async () => {
    const user = userEvent.setup();
    render(<MemorizeTranscript />);

    await user.click(screen.getByRole('button', { name: /watch video/i }));
    expect(document.querySelector('video')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Chapter 13' }));
    await user.click(screen.getByRole('button', { name: 'Chapter 8' }));
    expect(document.querySelector('video')).not.toBeInTheDocument();
  });
});
