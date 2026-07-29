import { FlashCard } from '@/lib/spaced-repetition';

interface WordFormsProps {
  card: FlashCard;
  /** Hide the Shaami row — e.g. when a prompt should not give the dialect away. */
  hideShaami?: boolean;
  className?: string;
}

/**
 * The secondary forms shown under the main (Fusha singular) word: its plural,
 * the Shaami equivalent, and the Shaami plural. Renders nothing when a card
 * has none of them, so single-form cards stay visually unchanged.
 */
const WordForms = ({ card, hideShaami, className = '' }: WordFormsProps) => {
  const shaami = hideShaami ? null : card.shaami;
  const shaamiPlural = hideShaami ? null : card.shaamiPlural;
  if (!card.fushaPlural && !shaami && !shaamiPlural) return null;

  const shaamiLine = [shaami, shaamiPlural].filter(Boolean).join('  ·  ');

  return (
    <div className={`flex flex-col items-center gap-0.5 ${className}`}>
      {card.fushaPlural && (
        <p className="font-arabic text-lg text-muted-foreground" dir="rtl">
          <span className="text-xs align-middle opacity-70">ج.&nbsp;</span>
          {card.fushaPlural}
        </p>
      )}
      {shaamiLine && (
        <p className="font-arabic text-lg text-muted-foreground/90" dir="rtl">
          <span className="text-xs align-middle opacity-70">شامي&nbsp;</span>
          {shaamiLine}
        </p>
      )}
    </div>
  );
};

export default WordForms;
