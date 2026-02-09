import { useState } from 'react';
import { FlashCard, Rating } from '@/lib/spaced-repetition';
import { RotateCcw } from 'lucide-react';

interface FlashcardProps {
  card: FlashCard;
  onRate: (rating: Rating) => void;
}

const ratingButtons: { rating: Rating; label: string; colorClass: string }[] = [
  { rating: 'again', label: 'Again', colorClass: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' },
  { rating: 'hard', label: 'Hard', colorClass: 'bg-warning hover:bg-warning/90 text-warning-foreground' },
  { rating: 'good', label: 'Good', colorClass: 'bg-success hover:bg-success/90 text-success-foreground' },
  { rating: 'easy', label: 'Easy', colorClass: 'bg-info hover:bg-info/90 text-info-foreground' },
];

const Flashcard = ({ card, onRate }: FlashcardProps) => {
  const [flipped, setFlipped] = useState(false);

  const handleRate = (rating: Rating) => {
    setFlipped(false);
    onRate(rating);
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <button
        onClick={() => setFlipped(!flipped)}
        className="w-full min-h-[320px] rounded-2xl bg-card flashcard-shadow hover:flashcard-shadow-hover transition-all duration-300 flex flex-col items-center justify-center p-8 cursor-pointer border border-border/50 active:scale-[0.98]"
      >
        {!flipped ? (
          <div className="space-y-4 text-center">
            <p className="font-arabic text-5xl font-bold text-foreground leading-relaxed" dir="rtl">
              {card.word}
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 justify-center">
              <RotateCcw className="w-3.5 h-3.5" />
              Tap to flip
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-center w-full">
            <p className="font-arabic text-2xl text-muted-foreground" dir="rtl">
              {card.word}
            </p>
            <div className="w-full h-px bg-border" />
            {card.imageUrl ? (
              <img
                src={card.imageUrl}
                alt={card.word}
                className="w-full max-w-[400px] mx-auto rounded-xl object-cover aspect-video"
                loading="lazy"
              />
            ) : (
              <div className="text-6xl py-4">📖</div>
            )}
          </div>
        )}
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
