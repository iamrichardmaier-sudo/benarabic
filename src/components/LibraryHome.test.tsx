import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LibraryHome from './LibraryHome';
import type { LibraryText } from '@/hooks/useLibraryTexts';

const saved: LibraryText[] = [
  { id: 'a', title: 'نص محفوظ', body: 'كلمات', english: '', coverUrl: 'data:image/jpeg;base64,xxx', updatedAt: '2026-09-15', wordTags: {} },
  { id: 'b', title: 'بدون غلاف', body: 'كلمات', english: '', coverUrl: null, updatedAt: '2026-09-14', wordTags: {} },
];

describe('LibraryHome', () => {
  it('shows nothing of the reader\'s own when they have saved nothing', () => {
    render(<LibraryHome onSelect={() => {}} />);
    expect(screen.getByText('The Bible')).toBeInTheDocument();
    expect(screen.queryByText('Yours')).toBeNull();
  });

  it('lists what the reader saved, with a cover where there is one', () => {
    const { container } = render(
      <LibraryHome onSelect={() => {}} texts={saved} onOpenText={() => {}} />,
    );
    expect(screen.getByText('Yours')).toBeInTheDocument();
    expect(screen.getByText('نص محفوظ')).toBeInTheDocument();

    // Queried out of the DOM rather than by role: the cover carries an empty
    // alt on purpose, since the title is right beside it and a screen reader
    // announcing both would say the same thing twice.
    const covers = container.querySelectorAll('img');
    expect(covers).toHaveLength(1);
    expect(covers[0]).toHaveAttribute('src', 'data:image/jpeg;base64,xxx');

    // The entry with no cover still lists, just without a picture.
    expect(screen.getByText('بدون غلاف')).toBeInTheDocument();
  });

  it('opens the entry that was tapped', async () => {
    const user = userEvent.setup();
    const onOpenText = vi.fn();
    render(<LibraryHome onSelect={() => {}} texts={saved} onOpenText={onOpenText} />);
    await user.click(screen.getByText('نص محفوظ'));
    expect(onOpenText).toHaveBeenCalledWith(saved[0]);
  });
});
