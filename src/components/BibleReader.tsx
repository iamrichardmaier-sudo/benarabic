import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, BookOpen, Columns2, MessageSquareText } from 'lucide-react';
import { useBibleBooks } from '@/hooks/useBibleBooks';
import { useBibleChapter } from '@/hooks/useBibleChapter';
import type { BibleBook } from '@/lib/bible-types';

type Mode = 'side' | 'tap';

const BOOK_KEY = 'arabic-flashcards-bible-book';
const CHAPTER_KEY = 'arabic-flashcards-bible-chapter';
const MODE_KEY = 'arabic-flashcards-bible-mode';

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
    /* preference just won't persist */
  }
}

const BibleReader = () => {
  const { books, loading: booksLoading, error: booksError } = useBibleBooks();

  const [bookCode, setBookCode] = useState<string | null>(() => readStored(BOOK_KEY));
  const [chapter, setChapter] = useState<number | null>(() => {
    const stored = readStored(CHAPTER_KEY);
    return stored ? Number(stored) : null;
  });
  const [mode, setMode] = useState<Mode>(() => (readStored(MODE_KEY) === 'tap' ? 'tap' : 'side'));
  const [showBookPicker, setShowBookPicker] = useState(false);
  const [showChapterPicker, setShowChapterPicker] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  // Default to Genesis 1 once the book list has loaded, if nothing was saved.
  useEffect(() => {
    if (!books || bookCode) return;
    setBookCode(books[0].code);
    setChapter(1);
  }, [books, bookCode]);

  const book = useMemo(() => books?.find((b) => b.code === bookCode) ?? null, [books, bookCode]);
  const effectiveChapter = chapter && book && chapter <= book.chapters ? chapter : 1;

  const { verses, loading: versesLoading, error: versesError } = useBibleChapter(bookCode, effectiveChapter);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setRevealed(new Set());
    if (typeof scrollRef.current?.scrollIntoView === 'function') {
      scrollRef.current.scrollIntoView({ block: 'start' });
    }
  }, [bookCode, effectiveChapter]);

  const selectBook = (code: string) => {
    setBookCode(code);
    setChapter(1);
    writeStored(BOOK_KEY, code);
    writeStored(CHAPTER_KEY, '1');
    setShowBookPicker(false);
  };

  const selectChapter = (c: number) => {
    setChapter(c);
    writeStored(CHAPTER_KEY, String(c));
    setShowChapterPicker(false);
  };

  const selectMode = (m: Mode) => {
    setMode(m);
    writeStored(MODE_KEY, m);
  };

  const goToChapter = (bookIdx: number, c: number) => {
    if (!books) return;
    const target = books[bookIdx];
    if (!target) return;
    setBookCode(target.code);
    setChapter(c);
    writeStored(BOOK_KEY, target.code);
    writeStored(CHAPTER_KEY, String(c));
  };

  const goPrev = () => {
    if (!books || !book) return;
    const idx = books.findIndex((b) => b.code === book.code);
    if (effectiveChapter > 1) return goToChapter(idx, effectiveChapter - 1);
    if (idx > 0) return goToChapter(idx - 1, books[idx - 1].chapters);
  };

  const goNext = () => {
    if (!books || !book) return;
    const idx = books.findIndex((b) => b.code === book.code);
    if (effectiveChapter < book.chapters) return goToChapter(idx, effectiveChapter + 1);
    if (idx < books.length - 1) return goToChapter(idx + 1, 1);
  };

  const toggleReveal = (v: number) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  };

  const isFirst = book && effectiveChapter === 1 && books?.[0]?.code === book.code;
  const isLast = book && books && effectiveChapter === book.chapters && books[books.length - 1].code === book.code;

  if (booksLoading) {
    return <p className="text-sm text-muted-foreground">Loading the Bible…</p>;
  }
  if (booksError || !books) {
    return <p className="text-sm text-destructive">{booksError ?? 'Could not load the Bible.'}</p>;
  }

  return (
    <div className="space-y-4" ref={scrollRef}>
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-foreground">Bible</h2>
        <p className="text-sm text-muted-foreground">
          Van Dyke Arabic (1865), paired with the King James Version.
        </p>
      </div>

      {/* Book / chapter pickers */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowBookPicker(true)}
          className="flex-1 flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-2.5 font-semibold text-foreground transition-colors hover:bg-muted/40"
        >
          <span className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            {book?.name ?? 'Book'}
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => setShowChapterPicker(true)}
          className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-2.5 font-semibold text-foreground transition-colors hover:bg-muted/40"
        >
          {effectiveChapter}
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1">
        <button
          onClick={() => selectMode('side')}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
            mode === 'side' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Columns2 className="w-4 h-4" />
          Side by Side
        </button>
        <button
          onClick={() => selectMode('tap')}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
            mode === 'tap' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <MessageSquareText className="w-4 h-4" />
          Arabic — Tap for English
        </button>
      </div>

      {/* Chapter nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={!!isFirst}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </button>
        <span className="text-sm font-medium text-foreground">
          {book?.name} {effectiveChapter}
        </span>
        <button
          onClick={goNext}
          disabled={!!isLast}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Reading area */}
      <div className="rounded-2xl border border-border bg-card p-5">
        {versesLoading && <p className="text-sm text-muted-foreground text-center py-8">Loading chapter…</p>}
        {versesError && <p className="text-sm text-destructive text-center py-8">{versesError}</p>}

        {verses && mode === 'side' && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {verses.map((v) => (
              <VerseRowPair key={v.v} verse={v} />
            ))}
          </div>
        )}

        {verses && mode === 'tap' && (
          <div className="space-y-2" dir="rtl">
            {verses.map((v) => (
              <div key={v.v}>
                <button
                  onClick={() => toggleReveal(v.v)}
                  className="w-full text-right font-arabic text-xl leading-loose text-foreground hover:text-primary transition-colors"
                >
                  <span className="font-sans text-xs text-muted-foreground align-super ml-1.5" dir="ltr">
                    {v.v}
                  </span>
                  {v.a}
                </button>
                {revealed.has(v.v) && (
                  <p
                    className="text-sm text-muted-foreground border-r-2 border-primary/40 pr-3 mt-1.5 mb-1"
                    dir="ltr"
                  >
                    {v.e}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom chapter nav, for continuous reading without scrolling back up */}
      {verses && (
        <div className="flex items-center justify-between">
          <button
            onClick={goPrev}
            disabled={!!isFirst}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev chapter
          </button>
          <button
            onClick={goNext}
            disabled={!!isLast}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            Next chapter
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground/70 text-center pb-2">
        Arabic: Smith &amp; Van Dyke (1865), tagged edition by STEPBible.org and Arabic Bible
        Outreach Ministry (CC BY-SA 4.0). English: King James Version (public domain).
      </p>

      {showBookPicker && (
        <BookPicker books={books} current={bookCode} onSelect={selectBook} onClose={() => setShowBookPicker(false)} />
      )}
      {showChapterPicker && book && (
        <ChapterPicker
          count={book.chapters}
          current={effectiveChapter}
          onSelect={selectChapter}
          onClose={() => setShowChapterPicker(false)}
        />
      )}
    </div>
  );
};

const VerseRowPair = ({ verse }: { verse: { v: number; a: string; e: string } }) => (
  <>
    <p className="text-sm text-muted-foreground" dir="ltr">
      <span className="text-xs text-muted-foreground/70 align-super mr-1">{verse.v}</span>
      {verse.e}
    </p>
    <p className="font-arabic text-lg text-foreground text-right" dir="rtl">
      {verse.a}
      <span className="font-sans text-xs text-muted-foreground/70 align-super mr-1.5" dir="ltr">
        {verse.v}
      </span>
    </p>
  </>
);

const OT_COUNT = 39;

const BookPicker = ({
  books,
  current,
  onSelect,
  onClose,
}: {
  books: BibleBook[];
  current: string | null;
  onSelect: (code: string) => void;
  onClose: () => void;
}) => {
  const ot = books.slice(0, OT_COUNT);
  const nt = books.slice(OT_COUNT);

  const section = (label: string, list: BibleBook[]) => (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        {list.map((b) => (
          <button
            key={b.code}
            onClick={() => onSelect(b.code)}
            aria-pressed={b.code === current}
            className={`rounded-xl border px-3 py-2.5 text-sm font-medium text-left transition-colors ${
              b.code === current
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:bg-muted/40'
            }`}
          >
            {b.name}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <h2 className="text-lg font-bold text-foreground">Choose a Book</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 max-w-lg mx-auto w-full">
        {section('Old Testament', ot)}
        {section('New Testament', nt)}
      </div>
    </div>
  );
};

const ChapterPicker = ({
  count,
  current,
  onSelect,
  onClose,
}: {
  count: number;
  current: number;
  onSelect: (chapter: number) => void;
  onClose: () => void;
}) => (
  <div className="fixed inset-0 z-50 bg-background flex flex-col">
    <div className="flex items-center justify-between px-4 py-4 border-b border-border">
      <h2 className="text-lg font-bold text-foreground">Choose a Chapter</h2>
      <button
        onClick={onClose}
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
    </div>
    <div className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full">
      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: count }, (_, i) => i + 1).map((c) => (
          <button
            key={c}
            onClick={() => onSelect(c)}
            aria-pressed={c === current}
            className={`aspect-square rounded-xl border text-sm font-semibold transition-colors ${
              c === current
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:bg-muted/40'
            }`}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  </div>
);

export default BibleReader;
