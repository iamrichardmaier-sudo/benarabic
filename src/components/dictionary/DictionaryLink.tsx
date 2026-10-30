import { BookA, ChevronRight } from 'lucide-react';
import { useDeckActions } from '@/contexts/DeckActionsContext';
import { cn } from '@/lib/utils';
import { pathFor } from '@/lib/app-routes';

/**
 * "Open in dictionary", for any word met in the app: on a card's answer side,
 * in the deck list, in a reader's word popover. The dictionary resolves the
 * Arabic itself, so nothing is loaded until the link is followed. Not shown
 * where there is no app around the component (tests, embedded screens).
 */
const DictionaryLink = ({ word, root, className }: { word?: string; root?: string; className?: string }) => {
  const { openDictionary } = useDeckActions();
  if (!openDictionary || (!word && !root)) return null;
  // A real link, so Ctrl/Cmd-click, middle-click and "Open in new tab" open the
  // dictionary on a page of its own; a plain click stays in the app.
  const href = `${import.meta.env.BASE_URL.replace(/\/$/, '')}${pathFor({
    tab: 'learn', view: 'dictionary', dictPath: word ?? `root/${root}`,
  })}`;
  return (
    <a
      href={href}
      onClick={(e) => {
        e.stopPropagation();
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        openDictionary(word ? { word } : { root });
      }}
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition-colors hover:text-primary/80',
        className,
      )}
    >
      <BookA className="h-3.5 w-3.5" />
      {word ? 'Open in dictionary' : 'Every word on this root in the dictionary'}
      <ChevronRight className="h-3 w-3" />
    </a>
  );
};

export default DictionaryLink;
