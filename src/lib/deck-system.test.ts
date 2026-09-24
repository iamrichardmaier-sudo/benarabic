import { describe, it, expect } from 'vitest';
import { nextAddedWordsTitle, ADDED_WORDS_PREFIX, IMPORT_PROMPT } from './added-words';
import { matchesDeck } from './deck-browse';
import { nextFreeIcon, DECK_ICON_KEYS, FOUNDATION_ICON } from './deck-icons';
import type { Deck } from './deck-store';

function deck(over: Partial<Deck> = {}): Deck {
  return {
    id: 'd1',
    title: 'I Chapter 12',
    icon: 'scroll',
    bookPartPrefix: 'I',
    chapterRange: '12',
    isPublic: true,
    isAdminDeck: true,
    createdBy: null,
    status: 'published',
    publishRequested: false,
    createdAt: '2026-09-17',
    category: null,
    iconUrl: null,
    ...over,
  };
}

describe('nextAddedWordsTitle', () => {
  it('starts at one', () => {
    expect(nextAddedWordsTitle([])).toBe(`${ADDED_WORDS_PREFIX} 1`);
  });

  it('counts past the ones already taken', () => {
    expect(nextAddedWordsTitle(['Added Words 1', 'Added Words 2'])).toBe('Added Words 3');
  });

  it('fills a gap rather than always going higher', () => {
    // Deleting "Added Words 2" should not push the next import to 4.
    expect(nextAddedWordsTitle(['Added Words 1', 'Added Words 3'])).toBe('Added Words 2');
  });

  it('ignores decks the learner has renamed', () => {
    // A renamed import no longer holds its number, so the number is free.
    expect(nextAddedWordsTitle(['Chapter 12 vocab', 'Added Words 1'])).toBe('Added Words 2');
  });

  it('is not fooled by a title that merely starts the same way', () => {
    expect(nextAddedWordsTitle(['Added Words 1 extra', 'Added Words'])).toBe('Added Words 1');
  });

  it('copes with stray whitespace', () => {
    expect(nextAddedWordsTitle(['  Added Words 1  '])).toBe('Added Words 2');
  });
});

describe('matchesDeck', () => {
  it('matches everything on an empty query', () => {
    expect(matchesDeck(deck(), '   ')).toBe(true);
  });

  it('finds a deck by its title', () => {
    expect(matchesDeck(deck(), 'chapter')).toBe(true);
  });

  it('finds a chapter by its number alone', () => {
    // Nobody types the part prefix when they are looking for chapter 12.
    expect(matchesDeck(deck(), '12')).toBe(true);
  });

  it('finds a deck by its book part', () => {
    expect(matchesDeck(deck({ title: 'II Chapter 1', bookPartPrefix: 'II' }), 'II')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(matchesDeck(deck({ title: 'Arabic 101' }), 'ARABIC')).toBe(true);
  });

  it('says no when nothing matches', () => {
    expect(matchesDeck(deck(), 'embark')).toBe(false);
  });

  it('does not fall over on a deck with no chapter or part', () => {
    const bare = deck({ title: 'My words', bookPartPrefix: null, chapterRange: null });
    expect(matchesDeck(bare, 'my')).toBe(true);
    expect(matchesDeck(bare, '12')).toBe(false);
  });
});

describe('nextFreeIcon', () => {
  it('gives every deck a different one', () => {
    const taken: string[] = [];
    for (let i = 0; i < 5; i++) taken.push(nextFreeIcon(taken));
    expect(new Set(taken).size).toBe(5);
  });

  it('never hands out the foundation icon', () => {
    // Arabic 101's mark is reserved, so a custom deck cannot impersonate it.
    const all = DECK_ICON_KEYS.map((_, i, arr) => nextFreeIcon(arr.slice(0, i)));
    expect(all).not.toContain(FOUNDATION_ICON);
  });

  it('falls back rather than returning nothing once they are all used', () => {
    expect(nextFreeIcon(DECK_ICON_KEYS)).toBe('book');
  });
});

describe('the import prompt', () => {
  it('names the two required fields and asks for bare JSON', () => {
    expect(IMPORT_PROMPT).toContain('"fusha" (required)');
    expect(IMPORT_PROMPT).toContain('"english" (required)');
    expect(IMPORT_PROMPT).toContain('no markdown code fence');
  });

  it('describes the fields without a worked example to copy from', () => {
    // An example list invites the model to return the example's words rather
    // than the learner's.
    expect(IMPORT_PROMPT).not.toContain('[{');
    for (const field of ['root', 'wordType', 'verbForm', 'gender', 'fushaPlural', 'companionForms']) {
      expect(IMPORT_PROMPT).toContain(`"${field}"`);
    }
  });

  it('tells the model to omit what it is unsure of rather than guess', () => {
    expect(IMPORT_PROMPT).toContain('rather than guessing');
  });
});
