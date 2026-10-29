import { BookA, ChevronRight } from 'lucide-react';
import { useDeckActions } from '@/contexts/DeckActionsContext';
import { cn } from '@/lib/utils';

/**
 * "Open in dictionary", for any word met in the app: on a card's answer side,
 * in the deck list, in a reader's word popover. The dictionary resolves the
 * Arabic itself, so nothing is loaded until the link is followed. Not shown
 * where there is no app around the component (tests, embedded screens).
 */
const DictionaryLink = ({ word, root, className }: { word?: string; root?: string; className?: string }) => {
  const { openDictionary } = useDeckActions();
  if (!openDictionary || (!word && !root)) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
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
    </button>
  );
};

export default DictionaryLink;
