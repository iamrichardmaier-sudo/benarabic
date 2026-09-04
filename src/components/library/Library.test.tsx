import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const books = [
  { code: 'Gen', name: 'Genesis', order: 1, chapters: 3 },
  ...Array.from({ length: 38 }, (_, i) => ({
    code: `OT${i}`, name: `Old ${i}`, order: i + 2, chapters: 2,
  })),
  { code: 'Matt', name: 'Matthew', order: 40, chapters: 2 },
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

// The reader loads through useChapterText now, which serves both the Bible's
// static JSON and the private texts held per reader in the database.
vi.mock('@/hooks/useChapterText', () => ({
  useChapterText: (_work: string, book: string | null, chapter: number | null) => ({
    verses: versesByKey[`${book}/${chapter}`] ?? [],
    loading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/useBibleWordTags', () => ({
  useBibleWordTags: () => new Map(),
}));

const audioMock = vi.fn((_b?: string | null, _c?: number | null) => null as string | null);
vi.mock('@/hooks/useBibleAudio', () => ({
  useBibleAudio: (b: string | null, c: number | null) => audioMock(b, c),
}));

import Library from './Library';

/** Drill from Library home all the way into Genesis 1. */
async function openGenesis1(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /The Bible/ }));
  await user.click(screen.getByRole('button', { name: /Old Testament/ }));
  await user.click(screen.getByRole('button', { name: /Genesis/ }));
  await user.click(screen.getByRole('button', { name: '1' }));
}

beforeEach(() => {
  localStorage.clear();
  audioMock.mockReset();
  audioMock.mockReturnValue(null);
});

describe('Library drill-down', () => {
  it('walks Library → Bible → Testament → book → chapter → reader', async () => {
    const user = userEvent.setup();
    render(<Library />);

    expect(screen.getByRole('heading', { name: 'Library' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /The Bible/ }));
    expect(screen.getByRole('heading', { name: 'The Bible' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Old Testament/ }));
    expect(screen.getByRole('heading', { name: 'Old Testament' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Genesis/ }));
    expect(screen.getByRole('heading', { name: 'Genesis' })).toBeInTheDocument();
    expect(screen.getByText('3 chapters')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '1' }));
    expect(screen.getByText('In the beginning')).toBeInTheDocument();
  });

  it('puts New Testament books in their own section', async () => {
    const user = userEvent.setup();
    render(<Library />);
    await user.click(screen.getByRole('button', { name: /The Bible/ }));
    await user.click(screen.getByRole('button', { name: /New Testament/ }));
    expect(screen.getByRole('button', { name: /Matthew/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Genesis/ })).not.toBeInTheDocument();
  });

  it('steps back up one level at a time', async () => {
    const user = userEvent.setup();
    render(<Library />);
    await openGenesis1(user);

    await user.click(screen.getByRole('button', { name: /Back to Chapters/ }));
    expect(screen.getByRole('heading', { name: 'Genesis' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Back to Old Testament/ }));
    expect(screen.getByRole('heading', { name: 'Old Testament' })).toBeInTheDocument();
  });

  it('jumps back up the hierarchy from the breadcrumb', async () => {
    const user = userEvent.setup();
    render(<Library />);
    await openGenesis1(user);

    await user.click(screen.getByRole('button', { name: /Genesis 1/ }));
    await user.click(screen.getByRole('button', { name: 'Library' }));
    expect(screen.getByRole('heading', { name: 'Library' })).toBeInTheDocument();
  });

  it('returns to the root when the Library tab is re-tapped', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Library resetToken={0} />);
    await openGenesis1(user);
    expect(screen.getByText('In the beginning')).toBeInTheDocument();

    rerender(<Library resetToken={1} />);
    expect(screen.getByRole('heading', { name: 'Library' })).toBeInTheDocument();
  });

  it('offers a resume shortcut once a chapter has been opened', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Library />);
    await openGenesis1(user);
    rerender(<Library resetToken={1} />);

    expect(screen.getByText('Genesis 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Continue reading/ }));
    expect(screen.getByText('In the beginning')).toBeInTheDocument();
  });

  it('opens straight into the stored position when asked to resume', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Library />);
    await openGenesis1(user);
    rerender(<Library resetToken={1} />);
    rerender(<Library resetToken={1} resumeToken={1} />);
    expect(screen.getByText('In the beginning')).toBeInTheDocument();
  });

  it('reaches Articles as a sibling of the Bible', async () => {
    const user = userEvent.setup();
    render(<Library />);
    await user.click(screen.getByRole('button', { name: /Articles/ }));
    expect(screen.getByRole('heading', { name: /Arabic in the Wild/ })).toBeInTheDocument();
  });
});

describe('ChapterReader', () => {
  it('pages to the next chapter and back', async () => {
    const user = userEvent.setup();
    render(<Library />);
    await openGenesis1(user);

    await user.click(screen.getByRole('button', { name: /^Next/ }));
    expect(screen.getByText('Thus were finished')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Previous/ }));
    expect(screen.getByText('In the beginning')).toBeInTheDocument();
  });

  it('keeps both English modes, defaulting to side-by-side', async () => {
    const user = userEvent.setup();
    render(<Library />);
    await openGenesis1(user);

    // Side-by-side shows English without any interaction.
    expect(screen.getByText('In the beginning')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reading settings' }));
    await user.click(screen.getByRole('button', { name: /Arabic only/ }));
    expect(screen.queryByText('In the beginning')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Verse 1, tap to reveal/ }));
    expect(screen.getByText('In the beginning')).toBeInTheDocument();
  });

  it('hides the chrome in full-screen mode and restores it', async () => {
    const user = userEvent.setup();
    render(<Library />);
    await openGenesis1(user);

    await user.click(screen.getByRole('button', { name: 'Full screen' }));
    expect(screen.queryByRole('button', { name: 'Reading settings' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Exit full screen' }));
    expect(screen.getByRole('button', { name: 'Reading settings' })).toBeInTheDocument();
  });

  it('shows the audio control only for chapters that have narration', async () => {
    const user = userEvent.setup();
    render(<Library />);
    await openGenesis1(user);
    expect(screen.queryByRole('button', { name: 'Audio' })).not.toBeInTheDocument();

    audioMock.mockReturnValue('https://audio.example.com/gen-1.mp3');
    await user.click(screen.getByRole('button', { name: /^Next/ }));
    expect(screen.getByRole('button', { name: 'Audio' })).toBeInTheDocument();
  });

  it('adjusts text size from the reader, sharing the value with Settings', async () => {
    const user = userEvent.setup();
    render(<Library />);
    await openGenesis1(user);

    await user.click(screen.getByRole('button', { name: 'Reading settings' }));
    expect(screen.getByText('100%')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Increase text size' }));
    expect(screen.getByText('110%')).toBeInTheDocument();
    // Written through the shared preferences store, not local component state.
    expect(localStorage.getItem('arabic-flashcards-bible-text-scale')).toBe('1.1');
  });
});

describe('Book of Mormon', () => {
  it('sits alongside the two testaments', async () => {
    const user = userEvent.setup();
    render(<Library />);
    await user.click(screen.getByRole('button', { name: /The Bible/ }));
    expect(screen.getByRole('button', { name: /Book of Mormon/ })).toBeInTheDocument();
  });

  it('walks Book of Mormon \u2192 book \u2192 chapter \u2192 reader', async () => {
    const user = userEvent.setup();
    render(<Library />);
    await user.click(screen.getByRole('button', { name: /The Bible/ }));
    await user.click(screen.getByRole('button', { name: /Book of Mormon/ }));
    expect(screen.getByRole('heading', { name: 'Book of Mormon' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /1 Nephi/ }));
    expect(screen.getByRole('heading', { name: '1 Nephi' })).toBeInTheDocument();
    expect(screen.getByText('22 chapters')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '1' }));
    // The breadcrumb path is collapsed by default, so the back control is what
    // shows the reader actually opened.
    expect(screen.getByRole('button', { name: /Back to Chapters/ })).toBeInTheDocument();
  });

  it('comes back out to the section list', async () => {
    const user = userEvent.setup();
    render(<Library />);
    await user.click(screen.getByRole('button', { name: /The Bible/ }));
    await user.click(screen.getByRole('button', { name: /Book of Mormon/ }));
    await user.click(screen.getByRole('button', { name: /Back to The Bible/ }));
    expect(screen.getByRole('heading', { name: 'The Bible' })).toBeInTheDocument();
  });
});
