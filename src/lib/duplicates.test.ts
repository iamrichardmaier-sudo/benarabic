import { describe, it, expect } from 'vitest';
import { splitDuplicates } from './duplicates';
import { createCard } from './spaced-repetition';

const card = (word: string) => createCard(word, 'x');

describe('splitDuplicates', () => {
  it('keeps new words and drops ones the deck already holds', () => {
    const { fresh, duplicates } = splitDuplicates([card('كِتاب')], [card('بَيت'), card('كتاب')]);
    expect(fresh.map((c) => c.word)).toEqual(['بَيت']);
    expect(duplicates.map((c) => c.word)).toEqual(['كتاب']);
  });

  it('ignores vowels, alef variants and a second spelling after a slash', () => {
    const existing = [card('أَخَذَ'), card('طول / طِوال')];
    const { duplicates } = splitDuplicates(existing, [card('اخذ'), card('طُول')]);
    expect(duplicates).toHaveLength(2);
  });

  it('drops a repeat within the same batch, keeping the first', () => {
    const { fresh, duplicates } = splitDuplicates([], [card('بيت'), card('بَيت'), card('كتاب')]);
    expect(fresh.map((c) => c.word)).toEqual(['بيت', 'كتاب']);
    expect(duplicates).toHaveLength(1);
  });

  it('keeps a homograph apart when the card says which word it is', () => {
    const { fresh } = splitDuplicates([card('مَلِك')], [card('ملك (فعل)')]);
    expect(fresh).toHaveLength(1);
  });

  it('never calls an empty word a duplicate', () => {
    const { fresh } = splitDuplicates([card('')], [card('')]);
    expect(fresh).toHaveLength(1);
  });
});
