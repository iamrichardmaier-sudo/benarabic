import { CheckCircle2 } from 'lucide-react';

interface ReviewCompleteProps {
  /** How many cards were graded in the session just finished. */
  reviewed?: number;
  onDone?: () => void;
}

const ReviewComplete = ({ reviewed, onDone }: ReviewCompleteProps) => (
  <div className="text-center space-y-4 py-12">
    <CheckCircle2 className="w-16 h-16 text-success mx-auto" />
    <h2 className="text-2xl font-bold text-foreground">All done!</h2>
    <p className="text-muted-foreground">
      {reviewed ? `${reviewed} card${reviewed === 1 ? '' : 's'} reviewed. ` : ''}
      Come back tomorrow for more.
    </p>
    {onDone && (
      <button
        onClick={onDone}
        className="inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground px-6 py-3 font-semibold transition-all active:scale-95"
      >
        Back to Home
      </button>
    )}
  </div>
);

export default ReviewComplete;
