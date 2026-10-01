import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import AddWordButton from '@/components/AddWordButton';

interface UntaggedWordPopoverProps {
  /** The word as it appears in the text, punctuation and all. */
  text: string;
}

/**
 * A word the corpus hasn't tagged yet, met while reading.
 *
 * Tapping a tagged word opens a popover; tapping this one used to do nothing
 * at all, which reads as the app being broken rather than as "this word has
 * no data yet" — the same word can be tagged in one reader (Arabic in the
 * Wild) and silent in another (the Bible/Book of Mormon reader) purely by
 * which one it's met in. This gives every reader the same response: a tap
 * always does something, even when there's nothing to show yet.
 */
const UntaggedWordPopover = ({ text }: UntaggedWordPopoverProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={text}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onClick={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
          className="cursor-help rounded underline decoration-dotted decoration-muted-foreground/30 underline-offset-4 transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {text}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="w-72 space-y-2"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-0.5 text-center">
          <p className="font-arabic text-xl font-bold text-foreground" dir="rtl">
            {text}
          </p>
          <p className="text-xs text-muted-foreground">Nothing recorded for this word yet.</p>
        </div>
        <div className="border-t border-border/60 pt-2">
          <AddWordButton
            word={{ word: text, english: null, root: null, wordType: null, verbForm: null }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default UntaggedWordPopover;
