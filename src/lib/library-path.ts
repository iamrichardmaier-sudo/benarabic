/**
 * The Library's place, as the part of the address after /library:
 *
 *   (empty)              the Library's front page
 *   scripture            Bible and Book of Mormon sections
 *   scripture/ot|nt      a testament's books
 *   bible/John           a book's chapters
 *   bible/John/3         reading John 3
 *   bom, bom/1Ne, bom/1Ne/2   the same for the Book of Mormon
 *   articles             saved texts
 *   articles/<id>        one saved text
 */
export type Testament = 'ot' | 'nt';

export type LibraryPlace =
  | { kind: 'home' }
  | { kind: 'sections' }
  | { kind: 'books'; testament: Testament }
  | { kind: 'chapters'; bookCode: string }
  | { kind: 'reader'; bookCode: string; chapter: number }
  | { kind: 'bomBooks' }
  | { kind: 'bomChapters'; bookCode: string }
  | { kind: 'bomReader'; bookCode: string; chapter: number }
  | { kind: 'articles' }
  | { kind: 'saved'; textId: string };

export function libraryPathFor(place: LibraryPlace): string {
  switch (place.kind) {
    case 'home': return '';
    case 'sections': return 'scripture';
    case 'books': return `scripture/${place.testament}`;
    case 'chapters': return `bible/${place.bookCode}`;
    case 'reader': return `bible/${place.bookCode}/${place.chapter}`;
    case 'bomBooks': return 'bom';
    case 'bomChapters': return `bom/${place.bookCode}`;
    case 'bomReader': return `bom/${place.bookCode}/${place.chapter}`;
    case 'articles': return 'articles';
    case 'saved': return `articles/${place.textId}`;
  }
}

/** Unknown or malformed paths come back as the front page. */
export function parseLibraryPath(path: string): LibraryPlace {
  const parts = path.split('/').filter(Boolean);
  const chapter = (s: string | undefined) => {
    const n = Number(s);
    return Number.isInteger(n) && n >= 1 ? n : null;
  };
  switch (parts[0]) {
    case 'scripture':
      if (parts[1] === 'ot' || parts[1] === 'nt') return { kind: 'books', testament: parts[1] };
      return { kind: 'sections' };
    case 'bible':
      if (!parts[1]) return { kind: 'sections' };
      return chapter(parts[2])
        ? { kind: 'reader', bookCode: parts[1], chapter: chapter(parts[2])! }
        : { kind: 'chapters', bookCode: parts[1] };
    case 'bom':
      if (!parts[1]) return { kind: 'bomBooks' };
      return chapter(parts[2])
        ? { kind: 'bomReader', bookCode: parts[1], chapter: chapter(parts[2])! }
        : { kind: 'bomChapters', bookCode: parts[1] };
    case 'articles':
      return parts[1] ? { kind: 'saved', textId: parts[1] } : { kind: 'articles' };
    default:
      return { kind: 'home' };
  }
}
