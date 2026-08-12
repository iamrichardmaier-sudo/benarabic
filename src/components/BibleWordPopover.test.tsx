import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const fetchWordsByRootMock = vi.fn();

vi.mock('@/lib/bible-root-index', () => ({
  fetchWordsByRoot: (...args: unknown[]) => fetchWordsByRootMock(...args),
}));

import BibleWordPopover from './BibleWordPopover';
import type { BibleWordTag } from '@/hooks/useBibleWordTags';

const tag: BibleWordTag = {
  surface: 'كَتَبَ',
  root: 'ك-ت-ب',
  lemma: 'كَتَبَ',
  pos: 'verb',
  verbForm: 'I',
  gloss: 'wrote',
};

beforeEach(() => {
  fetchWordsByRootMock.mockReset();
});

describe('BibleWordPopover', () => {
  it('shows lemma, part of speech, and gloss on tap', async () => {
    fetchWordsByRootMock.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<BibleWordPopover text="كَتَبَ" tag={tag} />);

    await user.click(screen.getByRole('button', { name: /كَتَبَ/ }));
    expect(await screen.findByText('wrote')).toBeInTheDocument();
    expect(screen.getByText(/Verb/)).toBeInTheDocument();
    expect(screen.getByText(/Form I/)).toBeInTheDocument();
  });

  it('lazily loads other words sharing the root once opened', async () => {
    fetchWordsByRootMock.mockResolvedValue([
      { surface: 'كِتَاب', root: 'ك-ت-ب', lemma: 'كِتَاب', pos: 'noun', verbForm: null, gloss: 'book' },
    ]);
    const user = userEvent.setup();
    render(<BibleWordPopover text="كَتَبَ" tag={tag} />);

    expect(fetchWordsByRootMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /كَتَبَ/ }));
    expect(fetchWordsByRootMock).toHaveBeenCalledWith('ك-ت-ب', 'كَتَبَ');
    expect(await screen.findByText('book')).toBeInTheDocument();
  });

  it('says so when no other tagged word shares the root yet', async () => {
    fetchWordsByRootMock.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<BibleWordPopover text="كَتَبَ" tag={tag} />);

    await user.click(screen.getByRole('button', { name: /كَتَبَ/ }));
    expect(await screen.findByText(/No other tagged words/)).toBeInTheDocument();
  });

  it('skips the root section entirely for a word with no root (particles, names)', async () => {
    const user = userEvent.setup();
    render(
      <BibleWordPopover
        text="فِي"
        tag={{ surface: 'فِي', root: null, lemma: 'فِي', pos: 'particle', verbForm: null, gloss: 'in' }}
      />,
    );

    await user.click(screen.getByRole('button', { name: /فِي/ }));
    expect(await screen.findByText('in')).toBeInTheDocument();
    expect(fetchWordsByRootMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/Root/)).not.toBeInTheDocument();
  });
});
