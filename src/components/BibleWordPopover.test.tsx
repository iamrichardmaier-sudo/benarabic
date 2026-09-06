import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const fetchWordsByRootMock = vi.fn();

const fetchFormsOfLemmaMock = vi.fn();

vi.mock('@/lib/bible-root-index', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/bible-root-index')>()),
  fetchWordsByRoot: (...args: unknown[]) => fetchWordsByRootMock(...args),
  fetchFormsOfLemma: (...args: unknown[]) => fetchFormsOfLemmaMock(...args),
}));

import BibleWordPopover from './BibleWordPopover';
import type { BibleWordTag } from '@/hooks/useBibleWordTags';
import type { FlashCard } from '@/lib/spaced-repetition';
import { DeckContext } from '@/contexts/DeckContext';

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
  fetchFormsOfLemmaMock.mockReset();
  fetchFormsOfLemmaMock.mockResolvedValue([]);
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
    expect(await screen.findByText(/No other words on this root/)).toBeInTheDocument();
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

  it('gives a root-only word the meaning of its root rather than a blank', async () => {
    // Four fifths of the Book of Mormon's tagged forms carry a root and
    // nothing else. Before this, tapping one showed a heading, a root, and a
    // column of bare Arabic with no translations against it.
    fetchWordsByRootMock.mockResolvedValue([
      { surface: 'كَلِمَة', lemma: 'كَلِمَة', root: 'ك-ل-م', pos: 'noun', verbForm: null, gloss: 'word' },
      { surface: 'كَلام', lemma: 'كَلام', root: 'ك-ل-م', pos: 'noun', verbForm: null, gloss: 'speech' },
    ]);
    const user = userEvent.setup();
    render(
      <BibleWordPopover
        text="كَلِماتِهِ"
        tag={{ surface: 'كَلِماتِهِ', root: 'ك-ل-م', lemma: null, pos: null, verbForm: null, gloss: null }}
      />,
    );

    await user.click(screen.getByRole('button', { name: /كَلِماتِهِ/ }));
    expect(await screen.findByText('word')).toBeInTheDocument();
    expect(screen.getByText('ك-ل-م')).toBeInTheDocument();
    // And it says whose meaning that is, rather than passing it off as the
    // meaning of the form the reader tapped.
    expect(screen.getByText(/not glossed on its own/i)).toBeInTheDocument();
  });

  it('does not print the stand-in twice', async () => {
    fetchWordsByRootMock.mockResolvedValue([
      { surface: 'كَلِمَة', lemma: 'كَلِمَة', root: 'ك-ل-م', pos: 'noun', verbForm: null, gloss: 'word' },
    ]);
    const user = userEvent.setup();
    render(
      <BibleWordPopover
        text="كَلِماتِهِ"
        tag={{ surface: 'كَلِماتِهِ', root: 'ك-ل-م', lemma: null, pos: null, verbForm: null, gloss: null }}
      />,
    );

    await user.click(screen.getByRole('button', { name: /كَلِماتِهِ/ }));
    expect(await screen.findByText('word')).toBeInTheDocument();
    expect(screen.getAllByText('كَلِمَة')).toHaveLength(1);
  });

  it('lists the other spellings the word wears in the text', async () => {
    fetchWordsByRootMock.mockResolvedValue([]);
    fetchFormsOfLemmaMock.mockResolvedValue(['الْكَلِماتِ', 'كَلِماتِهِ']);
    const user = userEvent.setup();
    render(
      <BibleWordPopover
        text="كَلِمَة"
        tag={{ surface: 'كَلِمَة', root: 'ك-ل-م', lemma: 'كَلِمَة', pos: 'noun', verbForm: null, gloss: 'word' }}
      />,
    );

    await user.click(screen.getByRole('button', { name: /كَلِمَة/ }));
    expect(await screen.findByText('Its other forms')).toBeInTheDocument();
    expect(screen.getByText('الْكَلِماتِ')).toBeInTheDocument();
  });

  it('does not ask for other forms of a word the corpus never named', async () => {
    // A root-only form has no lemma to gather siblings under, and guessing
    // from the skeleton would sweep in words that merely look alike.
    fetchWordsByRootMock.mockResolvedValue([]);
    const user = userEvent.setup();
    render(
      <BibleWordPopover
        text="كَلِماتِهِ"
        tag={{ surface: 'كَلِماتِهِ', root: 'ك-ل-م', lemma: null, pos: null, verbForm: null, gloss: null }}
      />,
    );

    await user.click(screen.getByRole('button', { name: /كَلِماتِهِ/ }));
    expect(fetchFormsOfLemmaMock).not.toHaveBeenCalled();
  });

  it('shows what the reader already knows on this root', async () => {
    fetchWordsByRootMock.mockResolvedValue([]);
    const user = userEvent.setup();
    render(
      <DeckContext.Provider
        value={[
          { id: '1', word: 'يخدم', wordVoweled: 'يَخدِم', english: 'to serve', root: 'خ-د-م' },
          { id: '2', word: 'كتب', wordVoweled: 'كَتَبَ', english: 'to write', root: 'ك-ت-ب' },
        ] as FlashCard[]}
      >
        <BibleWordPopover
          text="خِدْمَة"
          tag={{ surface: 'خِدْمَة', root: 'خ-د-م', lemma: 'خِدْمَة', pos: 'noun', verbForm: null, gloss: 'service' }}
        />
      </DeckContext.Provider>,
    );

    await user.click(screen.getByRole('button', { name: /خِدْمَة/ }));
    expect(await screen.findByText('Same root in your deck')).toBeInTheDocument();
    expect(screen.getByText('يَخدِم')).toBeInTheDocument();
    // A card on a different root is not "same root".
    expect(screen.queryByText('كَتَبَ')).not.toBeInTheDocument();
  });

  it('leaves the deck section out when nothing shares the root', async () => {
    fetchWordsByRootMock.mockResolvedValue([]);
    const user = userEvent.setup();
    render(
      <DeckContext.Provider value={[{ id: '2', word: 'كتب', wordVoweled: 'كَتَبَ', english: 'to write', root: 'ك-ت-ب' }] as FlashCard[]}>
        <BibleWordPopover
          text="خِدْمَة"
          tag={{ surface: 'خِدْمَة', root: 'خ-د-م', lemma: 'خِدْمَة', pos: 'noun', verbForm: null, gloss: 'service' }}
        />
      </DeckContext.Provider>,
    );

    await user.click(screen.getByRole('button', { name: /خِدْمَة/ }));
    expect(await screen.findByText('service')).toBeInTheDocument();
    expect(screen.queryByText('Same root in your deck')).not.toBeInTheDocument();
  });

  it('finds a deck card whose root spells its hamza differently', async () => {
    // The card says أ-ر-ض, the corpus says ء-ر-ض. Same root.
    fetchWordsByRootMock.mockResolvedValue([]);
    const user = userEvent.setup();
    render(
      <DeckContext.Provider
        value={[{ id: '1', word: 'ارض', wordVoweled: 'أَرْض', english: 'land', root: 'أ-ر-ض' }] as FlashCard[]}
      >
        <BibleWordPopover
          text="الْأَرْضِ"
          tag={{ surface: 'الْأَرْضِ', root: 'ء-ر-ض', lemma: 'أَرْض', pos: 'noun', verbForm: null, gloss: 'the land' }}
        />
      </DeckContext.Provider>,
    );

    await user.click(screen.getByRole('button', { name: /الْأَرْضِ/ }));
    expect(await screen.findByText('Same root in your deck')).toBeInTheDocument();
    expect(screen.getByText('land')).toBeInTheDocument();
  });
});
