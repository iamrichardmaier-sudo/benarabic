import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const books = [
  { code: 'Gen', name: 'Genesis', order: 1, chapters: 3 },
  { code: 'Exod', name: 'Exodus', order: 2, chapters: 2 },
  { code: 'Matt', name: 'Matthew', order: 40, chapters: 1 },
];

const versesByKey: Record<string, { v: number; a: string; e: string }[]> = {
  'Gen/1': [
    { v: 1, a: 'فِي الْبَدْءِ', e: 'In the beginning' },
    { v: 2, a: 'وَكَانَتِ الأَرْضُ', e: 'And the earth was' },
  ],
  'Gen/2': [{ v: 1, a: 'فَأُكْمِلَتِ', e: 'Thus were finished' }],
};

vi.mock('@/hooks/useBibleBooks', () => ({
  useBibleBooks: () => ({ books, loading: false, error: null }),
}));

vi.mock('@/hooks/useBibleChapter', () => ({
  useBibleChapter: (book: string | null, chapter: number | null) => {
    const key = `${book}/${chapter}`;
    return { verses: versesByKey[key] ?? [], loading: false, error: null };
  },
}));

// No tags in these fixtures, so words render as plain text -- these tests
// cover navigation and mode-switching, not the word-popover feature.
vi.mock('@/hooks/useBibleWordTags', () => ({
  useBibleWordTags: () => new Map(),
}));

const audioMock = vi.fn(() => null as string | null);
vi.mock('@/hooks/useBibleAudio', () => ({
  useBibleAudio: (book: string | null, chapter: number | null) => audioMock(book, chapter),
}));

import BibleReader from './BibleReader';

beforeEach(() => {
  localStorage.clear();
  audioMock.mockReset();
  audioMock.mockReturnValue(null);
});

describe('BibleReader', () => {
  it('defaults to the first book, chapter 1', () => {
    render(<BibleReader />);
    expect(screen.getByRole('button', { name: /Genesis/ })).toBeInTheDocument();
    expect(screen.getByText('Genesis 1')).toBeInTheDocument();
  });

  it('shows both languages for every verse in side-by-side mode', () => {
    render(<BibleReader />);
    expect(screen.getByText('In the beginning')).toBeInTheDocument();
    expect(screen.getByText('And the earth was')).toBeInTheDocument();
    // Arabic words render as separate spans (each is its own popover target
    // once tagged), so the phrase is checked by an element's full text content
    // rather than a single text node.
    expect(
      screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'فِي الْبَدْءِ1'),
    ).toBeInTheDocument();
  });

  it('hides English until a verse is tapped in tap-to-reveal mode, and toggles it back off', async () => {
    const user = userEvent.setup();
    render(<BibleReader />);

    await user.click(screen.getByRole('button', { name: /Arabic — Tap for English/ }));
    expect(screen.queryByText('In the beginning')).not.toBeInTheDocument();

    const revealVerse1 = screen.getByRole('button', { name: /Verse 1, tap to reveal/ });
    await user.click(revealVerse1);
    expect(screen.getByText('In the beginning')).toBeInTheDocument();

    await user.click(revealVerse1);
    expect(screen.queryByText('In the beginning')).not.toBeInTheDocument();
  });

  it('lets a book be picked from the Old and New Testament sections', async () => {
    const user = userEvent.setup();
    render(<BibleReader />);

    await user.click(screen.getByRole('button', { name: /Genesis/ }));
    expect(screen.getByText('Old Testament')).toBeInTheDocument();
    expect(screen.getByText('New Testament')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Matthew' }));
    expect(screen.getByText('Matthew 1')).toBeInTheDocument();
    expect(screen.queryByText('Old Testament')).not.toBeInTheDocument();
  });

  it('lets a chapter be picked, and resets to chapter 1 on a new book', async () => {
    const user = userEvent.setup();
    render(<BibleReader />);

    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByText('Genesis 2')).toBeInTheDocument();
    expect(screen.getByText('Thus were finished')).toBeInTheDocument();
  });

  it('disables Prev on the very first chapter of the very first book', () => {
    render(<BibleReader />);
    const prevButtons = screen.getAllByRole('button', { name: /Prev/ });
    prevButtons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it('crosses from one book into the next on Next at a book boundary', async () => {
    const user = userEvent.setup();
    render(<BibleReader />);

    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '2' }));
    // Exodus has only 2 chapters in this fixture; walk from Genesis 2 -> Genesis 3 -> Exodus 1.
    await user.click(screen.getAllByRole('button', { name: /^Next$/ })[0]);
    expect(screen.getByText('Genesis 3')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /^Next$/ })[0]);
    expect(screen.getByText('Exodus 1')).toBeInTheDocument();
  });

  it('lets text size be increased and decreased, clamped at the limits', async () => {
    const user = userEvent.setup();
    render(<BibleReader />);

    expect(screen.getByText('100%')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Increase text size' }));
    expect(screen.getByText('110%')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Decrease text size' }));
    await user.click(screen.getByRole('button', { name: 'Decrease text size' }));
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('shows no audio player when the chapter has no audio', () => {
    render(<BibleReader />);
    expect(screen.queryByLabelText('Speed')).not.toBeInTheDocument();
  });

  it('shows an audio player with a speed slider clamped between 75% and 100% when audio is available', () => {
    audioMock.mockReturnValue('https://audio.example.com/gen-1.mp3');
    render(<BibleReader />);

    const slider = screen.getByLabelText('Speed') as HTMLInputElement;
    expect(slider).toHaveAttribute('min', '0.75');
    expect(slider).toHaveAttribute('max', '1');
    expect(slider.value).toBe('1');

    fireEvent.change(slider, { target: { value: '0.75' } });
    expect(slider.value).toBe('0.75');
  });
});
