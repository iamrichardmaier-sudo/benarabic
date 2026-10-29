import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/bible-root-index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bible-root-index')>();
  return { ...actual, fetchWordsByRoot: vi.fn(async () => []) };
});
// The Learn hub's podcast shelf fetches a manifest; not what this is about.
vi.mock('@/components/podcasts/PodcastShelf', () => ({ default: () => null }));

import { render, screen, fireEvent, within } from '@testing-library/react';
import DeckSearch from './DeckSearch';
import FormExplorer from './forms/FormExplorer';
import LearnHub from './LearnHub';
import { createCard, type FlashCard } from '@/lib/spaced-repetition';

const card = (word: string, english: string, over: Partial<FlashCard> = {}): FlashCard => ({
  ...createCard(word, english), id: `${word}-${english}`, ...over,
});
const deck = [
  card('عَلَّمَ', 'to teach', { verbForm: 'II', wordType: 'verb', root: 'ع-ل-م' }),
  card('مُعَلِّم', 'teacher', { verbForm: 'II', wordType: 'participle', root: 'ع-ل-م' }),
  card('قَهْوة', 'coffee', { wordType: 'noun' }),
];

describe('DeckSearch', () => {
  it('finds a word by its meaning and opens its details in place', () => {
    render(<DeckSearch cards={deck} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search your words' }), { target: { value: 'coffee' } });
    const results = screen.getByRole('region', { name: 'Search results' });
    expect(within(results).getByText('1 match in your deck')).toBeInTheDocument();
    const row = within(results).getByRole('button', { name: 'coffee: show details' });
    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'true');
  });

  it('finds Arabic typed without vowels', () => {
    render(<DeckSearch cards={deck} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'قهوة' } });
    expect(screen.getByRole('button', { name: 'coffee: show details' })).toBeInTheDocument();
  });

  it('offers the dictionary when nothing in the deck matches, and clears', () => {
    const onLookUp = vi.fn();
    render(<DeckSearch cards={deck} onLookUp={onLookUp} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'camel' } });
    expect(screen.getByText('Nothing in your deck matches “camel”.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Look it up in the dictionary' }));
    expect(onLookUp).toHaveBeenCalledWith('camel');
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.queryByRole('region', { name: 'Search results' })).not.toBeInTheDocument();
  });
});

describe('FormExplorer', () => {
  it('lists the ten forms with counts and opens one onto its words', () => {
    render(<FormExplorer cards={deck} onBack={() => {}} />);
    expect(screen.getAllByRole('button', { name: /^Form [IVX]+, \d+ words?$/ })).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Form II, 2 words' }));
    expect(screen.getByRole('heading', { name: 'Form II' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Verbs' })).getByText('to teach')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Participles' })).getByText('teacher')).toBeInTheDocument();
    expect(screen.queryByText('coffee')).not.toBeInTheDocument();
  });

  it('says so when a form holds none of the deck', () => {
    render(<FormExplorer cards={deck} onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Form X, 0 words' }));
    expect(screen.getByText('None of your words is tagged Form X yet.')).toBeInTheDocument();
  });
});

describe('LearnHub', () => {
  it('offers Browse by form in Explore', () => {
    const onSelect = vi.fn();
    render(<LearnHub dueCount={0} learnCount={0} deckSize={3} onSelect={onSelect} onOpenPodcast={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Browse by form/ }));
    expect(onSelect).toHaveBeenCalledWith('formExplorer');
  });
});
