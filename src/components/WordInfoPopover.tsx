import { useState, ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FlashCard } from '@/lib/spaced-repetition';

interface WordInfoPopoverProps {
  card: FlashCard;
  children: ReactNode;
}

/**
 * The popover is worth showing for any card carrying extra forms — plural and
 * Shaami equivalents included — not just verbs with principal parts.
 */
function hasWordInfo(card: FlashCard): boolean {
  return !!(
    card.pastTense ||
    card.presentTense ||
    card.masdarForm ||
    card.fushaPlural ||
    card.shaami ||
    card.shaamiPlural ||
    (card.companionForms && card.companionForms.length > 0)
  );
}

/** Hover (desktop) or tap (touch) popover showing a word's principal parts and companion forms. */
const WordInfoPopover = ({ card, children }: WordInfoPopoverProps) => {
  const [open, setOpen] = useState(false);

  if (!hasWordInfo(card)) return <>{children}</>;

  const formRows: { label: string; value: string }[] = [
    { label: 'Plural', value: card.fushaPlural ?? '' },
    { label: 'Shaami', value: card.shaami ?? '' },
    { label: 'Shaami pl.', value: card.shaamiPlural ?? '' },
  ].filter((r) => r.value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setOpen((o) => !o);
          }}
          className="cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-4"
        >
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        className="w-72"
        align="center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          {formRows.length > 0 && (
            <div className="space-y-1 text-sm">
              {formRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <span className="font-arabic text-base text-foreground" dir="rtl">{row.value}</span>
                </div>
              ))}
            </div>
          )}
          {(card.pastTense || card.presentTense || card.masdarForm) && (
            <div className={`space-y-1 text-sm${formRows.length > 0 ? ' border-t border-border pt-2' : ''}`}>
              {card.pastTense && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">Past</span>
                  <span className="font-arabic text-base text-foreground" dir="rtl">{card.pastTense}</span>
                </div>
              )}
              {card.presentTense && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">Present</span>
                  <span className="font-arabic text-base text-foreground" dir="rtl">{card.presentTense}</span>
                </div>
              )}
              {card.masdarForm && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">Masdar</span>
                  <span className="font-arabic text-base text-foreground" dir="rtl">{card.masdarForm}</span>
                </div>
              )}
            </div>
          )}
          {card.companionForms && card.companionForms.length > 0 && (
            <div className="space-y-1 border-t border-border pt-2 text-sm">
              {card.companionForms.slice(0, 4).map((cf, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{cf.label}</span>
                  <span className="font-arabic text-base text-foreground" dir="rtl">{cf.form}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default WordInfoPopover;
