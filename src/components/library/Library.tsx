import { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronRight, BookOpen } from 'lucide-react';
import { useBibleBooks } from '@/hooks/useBibleBooks';
import LibraryHome, { type LibraryDestination } from '@/components/LibraryHome';
import BackButton from '@/components/BackButton';
import ChapterReader from '@/components/library/ChapterReader';
import ArabicInTheWild from '@/components/ArabicInTheWild';
import { BOM_BOOKS, bomBook } from '@/lib/bom-books';
import type { BibleBook } from '@/lib/bible-types';

const OT_COUNT = 39;
const BOOK_KEY = 'arabic-flashcards-bible-book';
const CHAPTER_KEY = 'arabic-flashcards-bible-chapter';

type Testament = 'ot' | 'nt';

/** Where the reader is in the Library hierarchy. */
type Level =
  | { kind: 'home' }
  | { kind: 'sections' }
  | { kind: 'books'; testament: Testament }
  | { kind: 'chapters'; bookCode: string }
  | { kind: 'reader'; bookCode: string; chapter: number }
  // The Book of Mormon gets its own three levels rather than sharing the
  // Bible's. Its text comes from somewhere else entirely, and threading a
  // "which work" flag through the Bible's paths would put a branch in every
  // one of them to save three short blocks here.
  | { kind: 'bomBooks' }
  | { kind: 'bomChapters'; bookCode: string }
  | { kind: 'bomReader'; bookCode: string; chapter: number }
  | { kind: 'articles' };

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* position just won't persist */
  }
}

interface LibraryProps {
  /** Increments when the Library tab is tapped, signalling "return to root". */
  resetToken?: number;
  /** Increments when another screen asks the Library to open where it left off. */
  resumeToken?: number;
}

/**
 * The Library's navigation stack: Library → The Bible → Testament → book →
 * chapter list → reader, plus Articles as a sibling "book".
 *
 * Levels are held as explicit state rather than routes because the whole app is
 * a single authenticated screen; this keeps back behaviour predictable and lets
 * the bottom-nav tab reset the stack without a router round-trip.
 */
const Library = ({ resetToken = 0, resumeToken = 0 }: LibraryProps) => {
  const { books, loading, error } = useBibleBooks();
  const [level, setLevel] = useState<Level>({ kind: 'home' });

  // Tapping the already-active Library tab returns to the root.
  useEffect(() => {
    if (resetToken > 0) setLevel({ kind: 'home' });
  }, [resetToken]);

  // Another screen (Home's "continue reading") asked to jump straight in.
  useEffect(() => {
    if (resumeToken === 0 || !books) return;
    const code = readStored(BOOK_KEY);
    const ch = Number(readStored(CHAPTER_KEY) || '0');
    const b = code ? books.find((x) => x.code === code) : null;
    if (b && ch >= 1) setLevel({ kind: 'reader', bookCode: b.code, chapter: Math.min(ch, b.chapters) });
  }, [resumeToken, books]);

  const bookOf = useCallback(
    (code: string): BibleBook | null => books?.find((b) => b.code === code) ?? null,
    [books],
  );

  // Held in state, not derived from localStorage on render: a memo keyed on
  // `books` would never re-run after reading a chapter, so the resume shortcut
  // would not appear until the app was reloaded.
  const [lastRead, setLastRead] = useState<{ code: string; chapter: number } | null>(() => {
    const code = readStored(BOOK_KEY);
    const ch = Number(readStored(CHAPTER_KEY) || '0');
    return code && ch >= 1 ? { code, chapter: ch } : null;
  });

  const resume = useMemo(() => {
    if (!lastRead || !books) return null;
    const b = books.find((x) => x.code === lastRead.code);
    return b ? { book: b, chapter: Math.min(lastRead.chapter, b.chapters) } : null;
  }, [lastRead, books]);

  const openChapter = (bookCode: string, chapter: number) => {
    writeStored(BOOK_KEY, bookCode);
    writeStored(CHAPTER_KEY, String(chapter));
    setLastRead({ code: bookCode, chapter });
    setLevel({ kind: 'reader', bookCode, chapter });
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading the Library…</p>;
  if (error || !books) {
    return <p className="text-sm text-destructive">{error ?? 'Could not load the Library.'}</p>;
  }

  // ---------------------------------------------------------------- reader
  if (level.kind === 'reader') {
    const book = bookOf(level.bookCode);
    if (!book) {
      setLevel({ kind: 'home' });
      return null;
    }
    const idx = books.findIndex((b) => b.code === book.code);
    const testament: Testament = idx < OT_COUNT ? 'ot' : 'nt';

    return (
      <ChapterReader
        book={book}
        chapter={level.chapter}
        crumbs={[
          { label: 'Library', onJump: () => setLevel({ kind: 'home' }) },
          { label: 'The Bible', onJump: () => setLevel({ kind: 'sections' }) },
          {
            label: testament === 'ot' ? 'Old Testament' : 'New Testament',
            onJump: () => setLevel({ kind: 'books', testament }),
          },
          { label: book.name, onJump: () => setLevel({ kind: 'chapters', bookCode: book.code }) },
        ]}
        onBack={() => setLevel({ kind: 'chapters', bookCode: book.code })}
        onChangeChapter={(c) => openChapter(book.code, c)}
        onNextBook={idx < books.length - 1 ? () => openChapter(books[idx + 1].code, 1) : undefined}
        onPrevBook={
          idx > 0 ? () => openChapter(books[idx - 1].code, books[idx - 1].chapters) : undefined
        }
      />
    );
  }

  // -------------------------------------------------------------- chapters
  if (level.kind === 'chapters') {
    const book = bookOf(level.bookCode);
    if (!book) {
      setLevel({ kind: 'home' });
      return null;
    }
    const idx = books.findIndex((b) => b.code === book.code);
    const testament: Testament = idx < OT_COUNT ? 'ot' : 'nt';

    return (
      <div className="space-y-4">
        <BackButton
          label={testament === 'ot' ? 'Old Testament' : 'New Testament'}
          onClick={() => setLevel({ kind: 'books', testament })}
        />
        <h1 className="text-2xl font-bold text-foreground">{book.name}</h1>
        <p className="text-sm text-muted-foreground">{book.chapters} chapters</p>
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: book.chapters }, (_, i) => i + 1).map((c) => (
            <button
              key={c}
              onClick={() => openChapter(book.code, c)}
              className="aspect-square rounded-xl border border-border bg-card text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------- book list
  if (level.kind === 'books') {
    const list = level.testament === 'ot' ? books.slice(0, OT_COUNT) : books.slice(OT_COUNT);
    return (
      <div className="space-y-4">
        <BackButton label="The Bible" onClick={() => setLevel({ kind: 'sections' })} />
        <h1 className="text-2xl font-bold text-foreground">
          {level.testament === 'ot' ? 'Old Testament' : 'New Testament'}
        </h1>
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {list.map((b, i) => (
            <button
              key={b.code}
              onClick={() => setLevel({ kind: 'chapters', bookCode: b.code })}
              className={`w-full flex items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/40 ${
                i > 0 ? 'border-t border-border' : ''
              }`}
            >
              <span className="flex-1 font-medium text-foreground">{b.name}</span>
              <span className="text-xs text-muted-foreground">{b.chapters}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ------------------------------------------------- Book of Mormon reader
  if (level.kind === 'bomReader') {
    const book = bomBook(level.bookCode);
    if (!book) {
      setLevel({ kind: 'home' });
      return null;
    }
    const idx = BOM_BOOKS.findIndex((b) => b.code === book.code);

    return (
      <ChapterReader
        work="bom"
        book={book}
        chapter={level.chapter}
        crumbs={[
          { label: 'Library', onJump: () => setLevel({ kind: 'home' }) },
          { label: 'The Bible', onJump: () => setLevel({ kind: 'sections' }) },
          { label: 'Book of Mormon', onJump: () => setLevel({ kind: 'bomBooks' }) },
          {
            label: book.name,
            onJump: () => setLevel({ kind: 'bomChapters', bookCode: book.code }),
          },
        ]}
        onBack={() => setLevel({ kind: 'bomChapters', bookCode: book.code })}
        onChangeChapter={(c) => setLevel({ kind: 'bomReader', bookCode: book.code, chapter: c })}
        onNextBook={
          idx < BOM_BOOKS.length - 1
            ? () => setLevel({ kind: 'bomReader', bookCode: BOM_BOOKS[idx + 1].code, chapter: 1 })
            : undefined
        }
        onPrevBook={
          idx > 0
            ? () =>
                setLevel({
                  kind: 'bomReader',
                  bookCode: BOM_BOOKS[idx - 1].code,
                  chapter: BOM_BOOKS[idx - 1].chapters,
                })
            : undefined
        }
      />
    );
  }

  if (level.kind === 'bomChapters') {
    const book = bomBook(level.bookCode);
    if (!book) {
      setLevel({ kind: 'home' });
      return null;
    }
    return (
      <div className="space-y-4">
        <BackButton label="Book of Mormon" onClick={() => setLevel({ kind: 'bomBooks' })} />
        <h1 className="text-2xl font-bold text-foreground">{book.name}</h1>
        <p className="text-sm text-muted-foreground">{book.chapters} chapters</p>
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: book.chapters }, (_, i) => i + 1).map((c) => (
            <button
              key={c}
              onClick={() => setLevel({ kind: 'bomReader', bookCode: book.code, chapter: c })}
              className="aspect-square rounded-xl border border-border bg-card text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (level.kind === 'bomBooks') {
    return (
      <div className="space-y-4">
        <BackButton label="The Bible" onClick={() => setLevel({ kind: 'sections' })} />
        <h1 className="text-2xl font-bold text-foreground">Book of Mormon</h1>
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {BOM_BOOKS.map((b, i) => (
            <button
              key={b.code}
              onClick={() => setLevel({ kind: 'bomChapters', bookCode: b.code })}
              className={`w-full flex items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/40 ${
                i > 0 ? 'border-t border-border' : ''
              }`}
            >
              <span className="flex-1 font-medium text-foreground">{b.name}</span>
              <span className="text-xs text-muted-foreground">{b.chapters}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ------------------------------------------------------ section chooser
  if (level.kind === 'sections') {
    return (
      <div className="space-y-4">
        <BackButton label="Library" onClick={() => setLevel({ kind: 'home' })} />
        <h1 className="text-2xl font-bold text-foreground">The Bible</h1>
        <p className="text-sm text-muted-foreground">
          Smith &amp; Van Dyke (1865), fully vowelled, with the King James Version alongside.
        </p>
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {(['ot', 'nt'] as Testament[]).map((t, i) => (
            <button
              key={t}
              onClick={() => setLevel({ kind: 'books', testament: t })}
              className={`w-full flex items-center gap-3 px-4 py-4 text-start transition-colors hover:bg-muted/40 ${
                i > 0 ? 'border-t border-border' : ''
              }`}
            >
              <BookOpen className="w-5 h-5 text-primary shrink-0" />
              <span className="flex-1">
                <span className="block font-semibold text-foreground">
                  {t === 'ot' ? 'Old Testament' : 'New Testament'}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t === 'ot' ? `${OT_COUNT} books` : `${books.length - OT_COUNT} books`}
                </span>
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}

          {/* A third work alongside the two testaments. Its text is not part of
              the app — it is loaded per reader — so the chapters stand empty
              until one is. */}
          <button
            onClick={() => setLevel({ kind: 'bomBooks' })}
            className="w-full flex items-center gap-3 border-t border-border px-4 py-4 text-start transition-colors hover:bg-muted/40"
          >
            <BookOpen className="w-5 h-5 text-primary shrink-0" />
            <span className="flex-1">
              <span className="block font-semibold text-foreground">Book of Mormon</span>
              <span className="block text-xs text-muted-foreground">
                {BOM_BOOKS.length} books · your own copy
              </span>
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------- articles
  if (level.kind === 'articles') {
    return <ArabicInTheWild onBack={() => setLevel({ kind: 'home' })} />;
  }

  // ----------------------------------------------------------------- home
  const openDestination = (d: LibraryDestination) =>
    setLevel(d === 'bible' ? { kind: 'sections' } : { kind: 'articles' });

  return (
    <LibraryHome
      onSelect={openDestination}
      resume={resume ? { label: `${resume.book.name} ${resume.chapter}` } : null}
      onResume={resume ? () => openChapter(resume.book.code, resume.chapter) : undefined}
    />
  );
};

export default Library;
