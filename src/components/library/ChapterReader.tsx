import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronDown, Type, Volume2,
  Columns2, MessageSquareText, Maximize2, Minimize2,
} from 'lucide-react';
import { useBibleChapter } from '@/hooks/useBibleChapter';
import { useBibleAudio } from '@/hooks/useBibleAudio';
import { useBibleWordTags, type BibleWordTag } from '@/hooks/useBibleWordTags';
import { usePreferences } from '@/hooks/usePreferences';
import { useChapterSwipe } from '@/hooks/useChapterSwipe';
import {
  setTextScale, setAudioRate,
  TEXT_SCALE_MIN, TEXT_SCALE_MAX, TEXT_SCALE_STEP,
  AUDIO_RATE_MIN, AUDIO_RATE_MAX, AUDIO_RATE_STEP,
} from '@/lib/preferences';
import { chapterWords } from '@/lib/bible-words';
import ArabicWithTags from '@/components/ArabicWithTags';
import BackButton from '@/components/BackButton';
import type { BibleBook } from '@/lib/bible-types';

export type ReadMode = 'side' | 'tap';

const MODE_KEY = 'arabic-flashcards-bible-mode';

function readMode(): ReadMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'tap' ? 'tap' : 'side';
  } catch {
    return 'side';
  }
}

interface ChapterReaderProps {
  book: BibleBook;
  chapter: number;
  /** Breadcrumb path, innermost last. Tapping any crumb jumps up to it. */
  crumbs: { label: string; onJump: () => void }[];
  onBack: () => void;
  onChangeChapter: (chapter: number) => void;
  /** Called when paging past the last/first chapter of this book. */
  onNextBook?: () => void;
  onPrevBook?: () => void;
}

/**
 * The core reading screen. Reading chrome (back, breadcrumb, Aa, audio) sits
 * above a distraction-free text area; double-tapping the text hides all of it.
 *
 * Both English modes from the original reader are preserved: side-by-side,
 * where the two languages share one grid so a verse's two halves can never
 * drift apart, and tap-to-reveal for reading Arabic alone.
 */
const ChapterReader = ({
  book, chapter, crumbs, onBack, onChangeChapter, onNextBook, onPrevBook,
}: ChapterReaderProps) => {
  const prefs = usePreferences();
  const [mode, setMode] = useState<ReadMode>(readMode);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [showCrumbs, setShowCrumbs] = useState(false);
  const [panel, setPanel] = useState<'none' | 'text' | 'audio'>('none');
  const [immersive, setImmersive] = useState(false);

  const { verses, loading, error } = useBibleChapter(book.code, chapter);
  const wordList = useMemo(() => chapterWords(verses ?? []), [verses]);
  const wordTags = useBibleWordTags(wordList);
  const audioUrl = useBibleAudio(book.code, chapter);

  const topRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    setRevealed(new Set());
    setShowCrumbs(false);
    setPanel('none');
    if (typeof topRef.current?.scrollIntoView === 'function') {
      topRef.current.scrollIntoView({ block: 'start' });
    }
  }, [book.code, chapter]);

  // The audio element remounts per chapter, which resets playbackRate to 1.
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = prefs.audioRate;
  }, [audioUrl, prefs.audioRate]);

  const goNext = () => {
    if (chapter < book.chapters) onChangeChapter(chapter + 1);
    else onNextBook?.();
  };
  const goPrev = () => {
    if (chapter > 1) onChangeChapter(chapter - 1);
    else onPrevBook?.();
  };

  const swipe = useChapterSwipe({
    onNext: goNext,
    onPrev: goPrev,
    onDoubleTap: () => setImmersive((v) => !v),
  });

  const chooseMode = (next: ReadMode) => {
    setMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* preference just won't persist */
    }
  };

  const toggleReveal = (v: number) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  };

  return (
    <div className="space-y-3" ref={topRef}>
      {!immersive && (
        <>
          {/* Chrome: back, tappable breadcrumb, reading controls */}
          <div className="flex items-center gap-2">
            <BackButton onClick={onBack} label="Chapters" className="shrink-0" />

            <div className="relative min-w-0 flex-1">
              <button
                onClick={() => setShowCrumbs((v) => !v)}
                aria-expanded={showCrumbs}
                className="flex items-center gap-1 max-w-full font-semibold text-foreground hover:text-primary transition-colors"
              >
                <span className="truncate">{book.name} {chapter}</span>
                <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
              </button>
              {showCrumbs && (
                <>
                  <button
                    aria-label="Close navigation path"
                    onClick={() => setShowCrumbs(false)}
                    className="fixed inset-0 z-40 cursor-default"
                  />
                  <div className="absolute start-0 top-9 z-50 w-60 rounded-xl border border-border bg-card p-1.5 shadow-lg">
                    {crumbs.map((c) => (
                      <button
                        key={c.label}
                        onClick={() => { setShowCrumbs(false); c.onJump(); }}
                        className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-start text-foreground hover:bg-muted/60 transition-colors"
                      >
                        {c.label}
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    ))}
                    <p className="px-3 py-2 text-sm font-semibold text-muted-foreground">
                      {book.name} {chapter}
                    </p>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setPanel((p) => (p === 'text' ? 'none' : 'text'))}
              aria-label="Reading settings"
              aria-expanded={panel === 'text'}
              className={`p-2 rounded-lg transition-colors ${
                panel === 'text' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Type className="w-4 h-4" />
            </button>
            {audioUrl && (
              <button
                onClick={() => setPanel((p) => (p === 'audio' ? 'none' : 'audio'))}
                aria-label="Audio"
                aria-expanded={panel === 'audio'}
                className={`p-2 rounded-lg transition-colors ${
                  panel === 'audio' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Volume2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setImmersive(true)}
              aria-label="Full screen"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {panel === 'text' && (
            <div className="rounded-xl border border-border bg-card p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">Text size</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTextScale(prefs.textScale - TEXT_SCALE_STEP)}
                    disabled={prefs.textScale <= TEXT_SCALE_MIN}
                    aria-label="Decrease text size"
                    className="w-8 h-8 rounded-lg border border-border text-sm font-semibold transition-colors hover:bg-muted/40 disabled:opacity-30 disabled:pointer-events-none"
                  >
                    A−
                  </button>
                  <span className="text-xs text-muted-foreground tabular-nums w-10 text-center">
                    {Math.round(prefs.textScale * 100)}%
                  </span>
                  <button
                    onClick={() => setTextScale(prefs.textScale + TEXT_SCALE_STEP)}
                    disabled={prefs.textScale >= TEXT_SCALE_MAX}
                    aria-label="Increase text size"
                    className="w-8 h-8 rounded-lg border border-border text-base font-semibold transition-colors hover:bg-muted/40 disabled:opacity-30 disabled:pointer-events-none"
                  >
                    A+
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1">
                <button
                  onClick={() => chooseMode('side')}
                  aria-pressed={mode === 'side'}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    mode === 'side' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Columns2 className="w-4 h-4" />
                  Side by side
                </button>
                <button
                  onClick={() => chooseMode('tap')}
                  aria-pressed={mode === 'tap'}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    mode === 'tap' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <MessageSquareText className="w-4 h-4" />
                  Arabic only
                </button>
              </div>
            </div>
          )}

          {panel === 'audio' && audioUrl && (
            <div className="rounded-xl border border-border bg-card p-3 space-y-2">
              {/* No caption track: this is narration of Arabic text already on
                  screen, so a transcript would duplicate the page itself. */}
              <audio ref={audioRef} key={audioUrl} controls preload="none" className="w-full h-9" src={audioUrl}>
                Your browser does not support audio playback.
              </audio>
              <div className="flex items-center gap-2">
                <label htmlFor="reader-speed" className="text-xs text-muted-foreground shrink-0">Speed</label>
                <input
                  id="reader-speed"
                  type="range"
                  min={AUDIO_RATE_MIN}
                  max={AUDIO_RATE_MAX}
                  step={AUDIO_RATE_STEP}
                  value={prefs.audioRate}
                  onChange={(e) => setAudioRate(Number(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <span className="text-xs text-muted-foreground tabular-nums w-9 text-end">
                  {Math.round(prefs.audioRate * 100)}%
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {immersive && (
        <button
          onClick={() => setImmersive(false)}
          aria-label="Exit full screen"
          className="fixed top-3 end-3 z-30 p-2 rounded-full bg-card/90 border border-border text-muted-foreground backdrop-blur-sm"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      )}

      {/* Reading area */}
      <div
        className="rounded-2xl border border-border bg-card p-5 select-none"
        style={{ '--bible-scale': prefs.textScale } as React.CSSProperties}
        onTouchStart={swipe.onTouchStart}
        onTouchEnd={swipe.onTouchEnd}
      >
        {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading chapter…</p>}
        {error && <p className="text-sm text-destructive text-center py-8">{error}</p>}

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
                    className="font-sans text-xs text-muted-foreground align-super ms-1.5 hover:text-primary transition-colors"
                    dir="ltr"
                  >
                    {v.v}
                  </button>
                  <ArabicWithTags text={v.a} tags={wordTags} />
                </p>
                {revealed.has(v.v) && (
                  <p
                    className="text-muted-foreground border-e-2 border-primary/40 pe-3 mt-1.5 mb-1"
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

      {/* Paging. Kept below the text so it is reachable after a long chapter. */}
      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={chapter === 1 && !onPrevBook}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>
        <span className="text-xs text-muted-foreground">Swipe to turn the page</span>
        <button
          onClick={goNext}
          disabled={chapter === book.chapters && !onNextBook}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground/70 text-center pb-2">
        Arabic: Smith &amp; Van Dyke (1865), tagged edition by STEPBible.org and Arabic Bible Outreach
        Ministry (CC BY-SA 4.0). English: King James Version (public domain).
        {audioUrl && ' Audio: Arabic Bible Outreach Ministry, read by Brother Adel Iskandar.'}
      </p>
    </div>
  );
};

const VerseRowPair = ({
  verse, tags,
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
      <span className="text-xs text-muted-foreground/70 align-super me-1">{verse.v}</span>
      {verse.e}
    </p>
    <p
      className="font-arabic text-foreground text-right"
      style={{ fontSize: 'calc(1.125rem * var(--bible-scale, 1))' }}
      dir="rtl"
    >
      <ArabicWithTags text={verse.a} tags={tags} />
      <span className="font-sans text-xs text-muted-foreground/70 align-super ms-1.5" dir="ltr">
        {verse.v}
      </span>
    </p>
  </>
);

export default ChapterReader;
