import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { FlashCard, Rating } from '@/lib/spaced-repetition';
import type { ReviewDirection } from '@/components/Flashcard';
import WaznLogo from '@/components/WaznLogo';
import SpeakButton, { speakArabic } from '@/components/SpeakButton';
import WordDetail from '@/components/WordDetail';
import { focusAction, focusHint } from '@/lib/focus-keys';
import { dialectView } from '@/lib/dialect';
import { usePreferences } from '@/hooks/usePreferences';

interface FocusReviewProps {
  card: FlashCard;
  direction?: ReviewDirection;
  onRate: (rating: Rating) => void;
  progress: { current: number; total: number };
  deck?: FlashCard[];
  onExit: () => void;
  /** True during a practice run, where nothing is rescheduled. */
  practising?: boolean;
}

/**
 * Review at full screen, driven by the arrow keys.
 *
 * This is the phone widget's session brought to the desktop, deliberately
 * down to the layout: one card filling the screen, a thin progress bar above
 * it, and two verdicts rather than four. The widget earned that shape on a
 * screen where every tap costs something, and the same economy is what makes
 * a keyboard session fast — reach for one key, not for a mouse and a grid of
 * four buttons.
 *
 * The buttons are still buttons, so the mouse and a screen reader lose
 * nothing, and Good and Hard remain on the other two arrows for anyone who
 * wants the full scale.
 */
const FocusReview = ({
  card, direction = 'ar-to-en', onRate, progress, deck = [], onExit, practising = false,
}: FocusReviewProps) => {
  const [flipped, setFlipped] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const { dialect } = usePreferences();
  const view = dialectView(card, dialect);

  // Each new card starts face down, at the top of its own scroll. Assigning
  // scrollTop rather than calling scrollTo, which the widget does too and
  // which every engine has had since long before smooth scrolling.
  useEffect(() => {
    setFlipped(false);
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [card.id]);

  // The widget reads the word aloud on both sides; so does this.
  useEffect(() => {
    speakArabic(view.spoken);
  }, [card.id, flipped, view.spoken]);

  const grade = (rating: Rating) => {
    setFlipped(false);
    onRate(rating);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const action = focusAction(e.key, flipped);
      if (!action) return;
      e.preventDefault();
      if (action.kind === 'exit') onExit();
      else if (action.kind === 'flip') setFlipped((f) => !f);
      else grade(action.rating);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // `flipped` is read inside, so the listener is replaced when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped, card.id]);

  const done = ((progress.current - 1) / progress.total) * 100;
  const headline = flipped ? (card.wordVoweled || view.headline) : view.headline;
  const showEnglishFirst = direction === 'en-to-ar' && !flipped;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 pt-4 pb-1">
        <span className="flex items-center gap-1.5 text-[13px] font-extrabold tracking-[0.06em] text-primary">
          <WaznLogo size={19} />
          WAZN
        </span>
        <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-[width] duration-[250ms] ease-out"
            style={{ width: `${done}%` }}
          />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {progress.current}/{progress.total}
        </span>
        <button
          onClick={onExit}
          aria-label="Leave full screen"
          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <p className="mx-auto w-full max-w-2xl pb-1 text-center text-[11px] text-muted-foreground/70">
        {practising ? 'Practice · nothing is rescheduled' : 'Esc to leave'}
      </p>

      <main ref={scroller} className="flex min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="m-auto w-full max-w-2xl text-center">
          {showEnglishFirst ? (
            <>
              {card.imageUrl && (
                <img
                  src={card.imageUrl}
                  alt=""
                  className="mx-auto mb-4 max-h-[26vh] max-w-[78%] rounded-2xl object-cover"
                />
              )}
              <p className="text-[32px] leading-snug text-muted-foreground">{card.english}</p>
            </>
          ) : (
            <>
              <p
                className={`font-arabic font-bold leading-[1.35] ${flipped ? 'text-[44px]' : 'text-[56px]'}`}
                dir="rtl"
              >
                {headline}
              </p>
              <div className="mt-3 flex justify-center">
                <SpeakButton word={view.spoken} size={20} />
              </div>
            </>
          )}

          {flipped && (
            <div className="mt-3 space-y-3 text-start">
              {direction === 'ar-to-en' ? (
                <>
                  {card.english && (
                    <p className="text-center text-[24px] leading-snug text-muted-foreground">
                      {card.english}
                    </p>
                  )}
                  {card.imageUrl && (
                    <img
                      src={card.imageUrl}
                      alt=""
                      className="mx-auto max-h-[26vh] max-w-[78%] rounded-2xl object-cover"
                    />
                  )}
                </>
              ) : null}
              <WordDetail card={card} deck={deck} includeCorpus />
            </div>
          )}
        </div>
      </main>

      <p className="mx-auto w-full max-w-2xl shrink-0 px-5 pb-2 text-center text-xs text-muted-foreground/70">
        {focusHint(flipped)}
        {flipped && <span className="ms-3 opacity-70">↑ Good · ↓ Hard</span>}
      </p>

      <footer
        className={`mx-auto flex w-full max-w-2xl gap-2.5 px-5 pb-7 ${flipped ? '' : 'invisible'}`}
      >
        <button
          onClick={() => grade('again')}
          disabled={!flipped}
          className="flex-1 rounded-2xl bg-destructive py-4 text-base font-bold text-destructive-foreground transition-all active:scale-95"
        >
          Again
        </button>
        <button
          onClick={() => grade('easy')}
          disabled={!flipped}
          className="flex-1 rounded-2xl bg-success py-4 text-base font-bold text-success-foreground transition-all active:scale-95"
        >
          Easy
        </button>
      </footer>
    </div>
  );
};

export default FocusReview;
