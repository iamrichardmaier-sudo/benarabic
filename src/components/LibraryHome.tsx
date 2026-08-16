import { BookOpen, Newspaper, ChevronRight } from 'lucide-react';

export type LibraryDestination = 'bible' | 'wild';

interface LibraryHomeProps {
  onSelect: (destination: LibraryDestination) => void;
  /** Last-read location, shown as a resume shortcut when one exists. */
  resume?: { label: string } | null;
  onResume?: () => void;
}

/**
 * Library root: everything readable, as a list of "books". Reading of any kind
 * enters from here, so the mental model stays one level deep and consistent —
 * scripture and imported articles behave the same way once opened.
 */
const LibraryHome = ({ onSelect, resume, onResume }: LibraryHomeProps) => (
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

    <p className="text-xs text-muted-foreground px-1">
      More texts are on the way. Anything you read here shares the same word lookup — root, form and
      meaning on tap.
    </p>
  </div>
);

export default LibraryHome;
