import { BookOpen, Newspaper, ChevronRight, Library as LibraryIcon } from 'lucide-react';
import type { LibraryText } from '@/hooks/useLibraryTexts';

export type LibraryDestination = 'bible' | 'wild';

interface LibraryHomeProps {
  onSelect: (destination: LibraryDestination) => void;
  /** Last-read location, shown as a resume shortcut when one exists. */
  resume?: { label: string } | null;
  onResume?: () => void;
  /** The reader's own saved texts. Private to them; never part of the app. */
  texts?: LibraryText[];
  /** Set when the list could not be loaded, so silence is never the answer. */
  textsError?: string | null;
  onOpenText?: (text: LibraryText) => void;
}

/**
 * Library root: everything readable, as a list of "books". Reading of any kind
 * enters from here, so the mental model stays one level deep and consistent —
 * scripture and imported articles behave the same way once opened.
 */
const LibraryHome = ({
  onSelect,
  resume,
  onResume,
  texts = [],
  textsError,
  onOpenText,
}: LibraryHomeProps) => (
  <div className="space-y-5">
    <div className="space-y-1">
      <h1 className="text-2xl font-bold text-foreground">Library</h1>
      <p className="text-sm text-muted-foreground">Read real Arabic, and tap any word you don't know.</p>
    </div>

    {resume && onResume && (
      <button
        onClick={onResume}
        className="w-full flex items-center justify-between gap-3 rounded-2xl bg-primary text-primary-foreground px-5 py-4 text-start transition-all active:scale-95"
      >
        <span className="min-w-0">
          <span className="block text-xs opacity-80">Continue reading</span>
          <span className="block font-semibold truncate">{resume.label}</span>
        </span>
        <ChevronRight className="w-5 h-5 opacity-80 shrink-0" />
      </button>
    )}

    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => onSelect('bible')}
        className="w-full flex items-center gap-3 px-4 py-4 text-start transition-colors hover:bg-muted/40"
      >
        <BookOpen className="w-5 h-5 text-primary shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-foreground">The Bible</span>
          <span className="block text-xs text-muted-foreground truncate">
            Fully vowelled Arabic with English alongside · 66 books, audio throughout
          </span>
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>
      <button
        onClick={() => onSelect('wild')}
        className="w-full flex items-center gap-3 px-4 py-4 text-start border-t border-border transition-colors hover:bg-muted/40"
      >
        <Newspaper className="w-5 h-5 text-primary shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-foreground">Articles</span>
          <span className="block text-xs text-muted-foreground truncate">
            Paste a link or your own text, then read it word by word
          </span>
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>
    </div>

    {textsError && (
      <p className="rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-xs text-destructive">
        Your saved texts could not be loaded just now, so any you have are not listed. They have
        not been lost — try again in a moment.
      </p>
    )}

    {texts.length > 0 && onOpenText && (
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Yours
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {texts.map((text) => (
            <button
              key={text.id}
              onClick={() => onOpenText(text)}
              className="overflow-hidden rounded-2xl border border-border bg-card text-start transition-all active:scale-95 hover:bg-muted/40"
            >
              {text.coverUrl ? (
                <img
                  src={text.coverUrl}
                  alt=""
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-muted/50">
                  <LibraryIcon className="h-8 w-8 text-muted-foreground/60" />
                </div>
              )}
              <span
                className="block truncate px-3 py-2 font-arabic text-sm font-semibold text-foreground"
                dir="rtl"
              >
                {text.title}
              </span>
            </button>
          ))}
        </div>
      </section>
    )}

    <p className="text-xs text-muted-foreground px-1">
      More texts are on the way. Anything you read here shares the same word lookup — root, form and
      meaning on tap.
    </p>
  </div>
);

export default LibraryHome;
