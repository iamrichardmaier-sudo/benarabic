import { useState, useEffect, useRef } from 'react';
import { FlashCard, Rating } from '@/lib/spaced-repetition';
import { RotateCcw } from 'lucide-react';
import SpeakButton, { speakArabic } from '@/components/SpeakButton';
import WordInfoPopover from '@/components/WordInfoPopover';

export type ReviewDirection = 'ar-to-en' | 'en-to-ar';

interface FlashcardProps {
  card: FlashCard;
  direction?: ReviewDirection;
  onRate: (rating: Rating) => void;
}

const ratingButtons: { rating: Rating; label: string; colorClass: string }[] = [
  { rating: 'again', label: 'Again', colorClass: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' },
  { rating: 'hard', label: 'Hard', colorClass: 'bg-warning hover:bg-warning/90 text-warning-foreground' },
  { rating: 'good', label: 'Good', colorClass: 'bg-success hover:bg-success/90 text-success-foreground' },
  { rating: 'easy', label: 'Easy', colorClass: 'bg-info hover:bg-info/90 text-info-foreground' },
];

const Flashcard = ({ card, direction = 'ar-to-en', onRate }: FlashcardProps) => {
  const [flipped, setFlipped] = useState(false);
  const prevFlipped = useRef(false);

  const handleRate = (rating: Rating) => {
    setFlipped(false);
    onRate(rating);
  };

  // Auto-speak Arabic when card is flipped to reveal
  useEffect(() => {
    if (flipped && !prevFlipped.current) {
      speakArabic(card.word);
    }
    prevFlipped.current = flipped;
  }, [flipped, card.word]);

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

  const renderArabic = () => (
    <div className="flex items-center justify-center gap-2">
      <WordInfoPopover card={card}>
        <p className="font-arabic text-[48px] font-bold text-foreground leading-relaxed" dir="rtl">
          {card.word}
        </p>
      </WordInfoPopover>
      <SpeakButton word={card.word} size={22} autoSpeak />
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
          {renderArabic()}
        </div>
      );
    }
    return (
      <div className="space-y-4 text-center w-full">
        <p className="font-arabic text-2xl text-muted-foreground" dir="rtl">
          {card.word}
        </p>
        <div className="w-full h-px bg-border" />
        {renderImageAndEnglish()}
      </div>
    );
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <button
        onClick={() => setFlipped(!flipped)}
        className="w-full min-h-[320px] rounded-2xl bg-card flashcard-shadow hover:flashcard-shadow-hover transition-all duration-300 flex flex-col items-center justify-center p-8 cursor-pointer border border-border/50 active:scale-[0.98]"
      >
        {!flipped ? renderFront() : renderBack()}
      </button>

      {flipped && (
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
      )}
    </div>
  );
};

export default Flashcard;
