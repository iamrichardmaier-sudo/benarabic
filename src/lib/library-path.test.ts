import { describe, it, expect } from 'vitest';
import { libraryPathFor, parseLibraryPath, type LibraryPlace } from './library-path';

describe('library paths', () => {
  const places: LibraryPlace[] = [
    { kind: 'home' }, { kind: 'sections' }, { kind: 'books', testament: 'nt' },
    { kind: 'chapters', bookCode: 'John' }, { kind: 'reader', bookCode: 'John', chapter: 3 },
    { kind: 'bomBooks' }, { kind: 'bomChapters', bookCode: '1Ne' }, { kind: 'bomReader', bookCode: '1Ne', chapter: 2 },
    { kind: 'articles' }, { kind: 'saved', textId: 'abc-123' },
  ];

  it('round-trips every place', () => {
    for (const p of places) expect(parseLibraryPath(libraryPathFor(p))).toEqual(p);
  });

  it('treats a bad chapter as the chapter list, and junk as the front page', () => {
    expect(parseLibraryPath('bible/John/zero')).toEqual({ kind: 'chapters', bookCode: 'John' });
    expect(parseLibraryPath('whatever')).toEqual({ kind: 'home' });
  });
});
