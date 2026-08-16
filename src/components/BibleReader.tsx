import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Columns2,
  MessageSquareText,
  Volume2,
  Settings,
} from 'lucide-react';
import { useBibleBooks } from '@/hooks/useBibleBooks';
import { useBibleChapter } from '@/hooks/useBibleChapter';
import { useBibleAudio } from '@/hooks/useBibleAudio';
import { useBibleWordTags, type BibleWordTag } from '@/hooks/useBibleWordTags';
import { tokenize } from '@/lib/transcript-mask';
import BibleWordPopover from '@/components/BibleWordPopover';
import type { BibleBook } from '@/lib/bible-types';

type Mode = 'side' | 'tap';

// The tagging pipeline strips the same leading/trailing punctuation before
// treating two occurrences as "the same word" -- matching that here is what
// lets a word in running text find its row in bible_word_tags.
const EDGE_PUNCTUATION = /^[.,،؛:؟!"«»()]+|[.,،؛:؟!"«»()]+$/g;

function lookupKey(word: string): string {
  return word.replace(EDGE_PUNCTUATION, '');
}

/** Every word in a chapter's Arabic text, for one bulk tag lookup per chapter
 * instead of one query per verse. */
function chapterWords(verses: { a: string }[]): string[] {
  const words: string[] = [];
  for (const v of verses) {
    for (const token of tokenize(v.a)) {
      if (token.isWord) words.push(lookupKey(token.text));
    }
  }
  return words;
}

/** Renders Arabic text word-by-word: tagged words get a hover/tap popover
 * with root, lemma, and gloss; everything else (whitespace, untagged words)
 * renders as plain text. */
function ArabicWithTags({ text, tags }: { text: string; tags: Map<string, BibleWordTag> }) {
  return (
    <>
      {tokenize(text).map((token, i) => {
        if (!token.isWord) return <span key={i}>{token.text}</span>;
        const tag = tags.get(lookupKey(token.text));
        if (!tag) return <span key={i}>{token.text}</span>;
        return <BibleWordPopover key={i} text={token.text} tag={tag} />;
      })}
    </>
  );
}

const BOOK_KEY = 'arabic-flashcards-bible-book';
const CHAPTER_KEY = 'arabic-flashcards-bible-chapter';
const MODE_KEY = 'arabic-flashcards-bible-mode';
const TEXT_SCALE_KEY = 'arabic-flashcards-bible-text-scale';
const PLAYBACK_RATE_KEY = 'arabic-flashcards-bible-audio-rate';

const TEXT_SCALE_MIN = 0.8;
const TEXT_SCALE_MAX = 1.3;
const TEXT_SCALE_STEP = 0.1;

const PLAYBACK_RATE_MIN = 0.75;
const PLAYBACK_RATE_MAX = 1;
const PLAYBACK_RATE_STEP = 0.05;

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

interface BibleReaderProps {
  /** Omitted when the reader is a top-level screen with nowhere to go back to. */
  onBack?: () => void;
}

const BibleReader = ({ onBack }: BibleReaderProps) => {
  const { books, loading: booksLoading, error: booksError } = useBibleBooks();

  const [bookCode, setBookCode] = useState<string | null>(() => readStored(BOOK_KEY));
  const [chapter, setChapter] = useState<number | null>(() => {
    const stored = readStored(CHAPTER_KEY);
    return stored ? Number(stored) : null;
  });
  const [mode, setMode] = useState<Mode>(() => (readStored(MODE_KEY) === 'tap' ? 'tap' : 'side'));
  const [showBookPicker, setShowBookPicker] = useState(false);
  const [showChapterPicker, setShowChapterPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [textScale, setTextScale] = useState<number>(() => {
    const stored = readStored(TEXT_SCALE_KEY);
    const n = stored ? Number(stored) : 1;
    return Number.isFinite(n) ? Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, n)) : 1;
  });
  const [playbackRate, setPlaybackRate] = useState<number>(() => {
    const stored = readStored(PLAYBACK_RATE_KEY);
    const n = stored ? Number(stored) : 1;
    return Number.isFinite(n) ? Math.min(PLAYBACK_RATE_MAX, Math.max(PLAYBACK_RATE_MIN, n)) : 1;
  });

  // Default to Genesis 1 once the book list has loaded, if nothing was saved.
  useEffect(() => {
    if (!books || bookCode) return;
    setBookCode(books[0].code);
    setChapter(1);
  }, [books, bookCode]);

  const book = useMemo(() => books?.find((b) => b.code === bookCode) ?? null, [books, bookCode]);
  const effectiveChapter = chapter && book && chapter <= book.chapters ? chapter : 1;

  const { verses, loading: versesLoading, error: versesError } = useBibleChapter(bookCode, effectiveChapter);
  const wordList = useMemo(() => chapterWords(verses ?? []), [verses]);
  const wordTags = useBibleWordTags(wordList);
  const audioUrl = useBibleAudio(bookCode, effectiveChapter);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setRevealed(new Set());
    if (typeof scrollRef.current?.scrollIntoView === 'function') {
      scrollRef.current.scrollIntoView({ block: 'start' });
    }
  }, [bookCode, effectiveChapter]);

  // The audio element remounts (key={audioUrl}) on every chapter change, which
  // resets playbackRate to 1 -- reapply the chosen speed each time.
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [audioUrl, playbackRate]);

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

  const adjustTextScale = (delta: number) => {
    setTextScale((prev) => {
      const next = Math.round(Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, prev + delta)) * 100) / 100;
      writeStored(TEXT_SCALE_KEY, String(next));
      return next;
    });
  };

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    writeStored(PLAYBACK_RATE_KEY, String(rate));
    if (audioRef.current) audioRef.current.playbackRate = rate;
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
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Library
        </button>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-foreground">Bible</h2>
          <p className="text-sm text-muted-foreground">
            Van Dyke Arabic (1865), paired with the King James Version.
          </p>
        </div>
        <div className="relative shrink-0">
          <button
            onClick={() => setShowSettings((v) => !v)}
            aria-label="Reading settings"
            aria-expanded={showSettings}
            className={`flex items-center justify-center w-9 h-9 rounded-xl border border-border transition-colors ${
              showSettings ? 'bg-muted text-foreground' : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>
          {showSettings && (
            <>
              <button
                aria-label="Close settings"
                onClick={() => setShowSettings(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div className="absolute right-0 top-11 z-50 w-56 rounded-xl border border-border bg-card p-3 shadow-lg">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Text size</p>
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => adjustTextScale(-TEXT_SCALE_STEP)}
                    disabled={textScale <= TEXT_SCALE_MIN}
                    aria-label="Decrease text size"
                    className="flex items-center justify-center w-8 h-8 rounded-lg border border-border text-sm font-semibold text-foreground transition-colors hover:bg-muted/40 disabled:opacity-30 disabled:pointer-events-none"
                  >
                    A<span className="text-xs">-</span>
                  </button>
                  <span className="text-xs text-muted-foreground tabular-nums">{Math.round(textScale * 100)}%</span>
                  <button
                    onClick={() => adjustTextScale(TEXT_SCALE_STEP)}
                    disabled={textScale >= TEXT_SCALE_MAX}
                    aria-label="Increase text size"
                    className="flex items-center justify-center w-8 h-8 rounded-lg border border-border text-base font-semibold text-foreground transition-colors hover:bg-muted/40 disabled:opacity-30 disabled:pointer-events-none"
                  >
                    A<span className="text-sm">+</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
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

      {/* Chapter audio, when available */}
      {audioUrl && (
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1">
          <Volume2 className="w-3.5 h-3.5 shrink-0 text-primary" />
          <audio ref={audioRef} key={audioUrl} controls preload="none" className="flex-1 h-7 min-w-0" src={audioUrl}>
            Your browser does not support audio playback.
          </audio>
          <label htmlFor="bible-audio-speed" className="text-[11px] text-muted-foreground shrink-0 pl-1">
            Speed
          </label>
          <input
            id="bible-audio-speed"
            type="range"
            min={PLAYBACK_RATE_MIN}
            max={PLAYBACK_RATE_MAX}
            step={PLAYBACK_RATE_STEP}
            value={playbackRate}
            onChange={(e) => changePlaybackRate(Number(e.target.value))}
            className="w-16 shrink-0 accent-primary"
          />
          <span className="text-[11px] text-muted-foreground tabular-nums w-8 text-right shrink-0">
            {Math.round(playbackRate * 100)}%
          </span>
        </div>
      )}

      {/* Reading area */}
      <div
        className="rounded-2xl border border-border bg-card p-5"
        style={{ '--bible-scale': textScale } as React.CSSProperties}
      >
        {versesLoading && <p className="text-sm text-muted-foreground text-center py-8">Loading chapter…</p>}
        {versesError && <p className="text-sm text-destructive text-center py-8">{versesError}</p>}

        {verses && mode === 'side' && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {verses.map((v) => (
              <VerseRowPair key={v.v} verse={v} tags={wordTags} />
            ))}
          </div>
        )}

        {verses && mode === 'tap' && (
          <div className="space-y-2" dir="rtl">
            {verses.map((v) => (
              <div key={v.v}>
                <p
                  className="font-arabic leading-loose text-foreground"
                  style={{ fontSize: 'calc(1.25rem * var(--bible-scale, 1))' }}
                >
                  <button
                    onClick={() => toggleReveal(v.v)}
                    aria-label={`Verse ${v.v}, tap to reveal the English translation`}
                    title="Tap to reveal the English translation"
                    className="font-sans text-xs text-muted-foreground align-super ml-1.5 hover:text-primary transition-colors"
                    dir="ltr"
                  >
                    {v.v}
                  </button>
                  <ArabicWithTags text={v.a} tags={wordTags} />
                </p>
                {revealed.has(v.v) && (
                  <p
                    className="text-muted-foreground border-r-2 border-primary/40 pr-3 mt-1.5 mb-1"
                    style={{ fontSize: 'calc(0.875rem * var(--bible-scale, 1))' }}
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
        {audioUrl && ' Audio: Arabic Bible Outreach Ministry, read by Brother Adel Iskandar.'}
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

const VerseRowPair = ({
  verse,
  tags,
}: {
  verse: { v: number; a: string; e: string };
  tags: Map<string, BibleWordTag>;
}) => (
  <>
    <p
      className="text-muted-foreground"
      style={{ fontSize: 'calc(0.875rem * var(--bible-scale, 1))' }}
      dir="ltr"
    >
      <span className="text-xs text-muted-foreground/70 align-super mr-1">{verse.v}</span>
      {verse.e}
    </p>
    <p
      className="font-arabic text-foreground text-right"
      style={{ fontSize: 'calc(1.125rem * var(--bible-scale, 1))' }}
      dir="rtl"
    >
      <ArabicWithTags text={verse.a} tags={tags} />
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
