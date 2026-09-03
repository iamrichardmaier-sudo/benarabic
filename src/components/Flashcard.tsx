import { useState, useEffect, useRef } from 'react';
import { FlashCard, Rating } from '@/lib/spaced-repetition';
import { RotateCcw } from 'lucide-react';
import SpeakButton, { speakArabic } from '@/components/SpeakButton';
import WordInfoPopover from '@/components/WordInfoPopover';
import WordForms from '@/components/WordForms';
import SwipeToGrade from '@/components/SwipeToGrade';
import WordDetail from '@/components/WordDetail';
import DialectToggle from '@/components/DialectToggle';
import { dialectView } from '@/lib/dialect';
import { usePreferences } from '@/hooks/usePreferences';

export type ReviewDirection = 'ar-to-en' | 'en-to-ar';

interface FlashcardProps {
  card: FlashCard;
  direction?: ReviewDirection;
  onRate: (rating: Rating) => void;
  /** Position in the current session, for the progress indicator. */
  progress?: { current: number; total: number };
  /** The whole deck, so the answer can show words sharing a root or a form. */
  deck?: FlashCard[];
}

const ratingButtons: { rating: Rating; label: string; colorClass: string }[] = [
  { rating: 'again', label: 'Again', colorClass: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' },
  { rating: 'hard', label: 'Hard', colorClass: 'bg-warning hover:bg-warning/90 text-warning-foreground' },
  { rating: 'good', label: 'Good', colorClass: 'bg-success hover:bg-success/90 text-success-foreground' },
  { rating: 'easy', label: 'Easy', colorClass: 'bg-info hover:bg-info/90 text-info-foreground' },
];

const Flashcard = ({ card, direction = 'ar-to-en', onRate, progress, deck = [] }: FlashcardProps) => {
  const [flipped, setFlipped] = useState(false);
  const prevFlipped = useRef(false);
  const { dialect } = usePreferences();
  const view = dialectView(card, dialect);

  const handleRate = (rating: Rating) => {
    setFlipped(false);
    onRate(rating);
  };

  // Auto-speak Arabic when card is flipped to reveal. Reads whichever
  // register is on screen, so studying Shaami does not read back Fusha.
  useEffect(() => {
    if (flipped && !prevFlipped.current) {
      speakArabic(view.spoken);
    }
    prevFlipped.current = flipped;
  }, [flipped, view.spoken]);

  const renderImageAndEnglish = () => (
    <div className="space-y-3 w-full">
      {card.imageUrl && (
        <img
          src={card.imageUrl}
          alt={card.word}
          className="w-full max-w-[400px] mx-auto rounded-xl object-cover aspect-video"
          loading="lazy"
        />
      )}
      {card.english && (
        <p className="text-[36px] text-muted-foreground text-center leading-snug">
          {card.english}
        </p>
      )}
      {!card.english && !card.imageUrl && (
        <p className="text-lg text-muted-foreground italic">Translation not available</p>
      )}
    </div>
  );

  /** `withForms` is off wherever WordDetail is also on screen: it lists the
   *  plural and the Shaami forms itself, so the line under the word would
   *  print them a second time. */
  const renderArabic = (withForms = true) => (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-2">
        <WordInfoPopover card={card}>
          <p className="font-arabic text-[48px] font-bold text-foreground leading-relaxed" dir="rtl">
            {view.headline}
          </p>
        </WordInfoPopover>
        <SpeakButton word={view.spoken} size={22} autoSpeak />
      </div>
      {withForms && <WordForms card={card} />}
    </div>
  );

  const renderFront = () => {
    if (direction === 'en-to-ar') {
      return (
        <div className="space-y-4 text-center w-full">
          {renderImageAndEnglish()}
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 justify-center">
            <RotateCcw className="w-3.5 h-3.5" />
            Tap to reveal Arabic
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-4 text-center">
        {renderArabic()}
        <p className="text-sm text-muted-foreground flex items-center gap-1.5 justify-center">
          <RotateCcw className="w-3.5 h-3.5" />
          Tap to flip
        </p>
      </div>
    );
  };

  const renderBack = () => {
    if (direction === 'en-to-ar') {
      return (
        <div className="space-y-4 text-center w-full">
          {card.english && (
            <p className="text-lg text-muted-foreground">{card.english}</p>
          )}
          <div className="w-full h-px bg-border" />
          {renderArabic(false)}
          <WordDetail card={card} deck={deck} includeCorpus />
        </div>
      );
    }
    return (
      <div className="space-y-4 text-center w-full">
        <p className="font-arabic text-2xl text-muted-foreground" dir="rtl">
          {view.headline}
        </p>
        <div className="w-full h-px bg-border" />
        {renderImageAndEnglish()}
        <WordDetail card={card} deck={deck} includeCorpus />
      </div>
    );
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <DialectToggle compact className="mx-auto w-auto" />

      {progress && progress.total > 0 && (
        <div className="space-y-1.5">
          <div
            className="h-1.5 rounded-full bg-muted overflow-hidden"
            role="progressbar"
            aria-valuenow={progress.current}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-label="Session progress"
          >
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center tabular-nums">
            {progress.current} of {progress.total}
          </p>
        </div>
      )}

      <SwipeToGrade onGrade={handleRate} enabled={flipped}>
        <button
          onClick={() => setFlipped(!flipped)}
          className="w-full min-h-[320px] rounded-2xl bg-card flashcard-shadow hover:flashcard-shadow-hover transition-all duration-300 flex flex-col items-center justify-center p-8 cursor-pointer border border-border/50 active:scale-[0.98]"
        >
          {!flipped ? renderFront() : renderBack()}
        </button>
      </SwipeToGrade>

      {flipped && (
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-2">
            {ratingButtons.map(({ rating, label, colorClass }) => (
              <button
                key={rating}
                onClick={() => handleRate(rating)}
                className={`py-3 px-2 rounded-xl font-semibold text-sm transition-all duration-150 active:scale-95 ${colorClass}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground text-center">
            Or swipe the card — left to repeat, right for good, up for easy, down for hard.
          </p>
        </div>
      )}
    </div>
  );
};

export default Flashcard;
