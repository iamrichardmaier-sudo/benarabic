import { DIALECT_LABELS, setDialect, type Dialect } from '@/lib/preferences';
import { usePreferences } from '@/hooks/usePreferences';

const ORDER: Dialect[] = ['msa', 'shaami', 'both'];

interface DialectToggleProps {
  /** Smaller chips, for sitting above a flashcard rather than in Settings. */
  compact?: boolean;
  className?: string;
}

/**
 * Chooses which Arabic the flashcards lead with. Writes to the shared
 * preference store, so the copy above the cards and the copy in Settings can
 * never disagree.
 */
const DialectToggle = ({ compact, className = '' }: DialectToggleProps) => {
  const { dialect } = usePreferences();

  return (
    <div
      role="radiogroup"
      aria-label="Which Arabic to study"
      className={`flex gap-1 rounded-full border border-border bg-card p-0.5 ${className}`}
    >
      {ORDER.map((id) => (
        <button
          key={id}
          role="radio"
          aria-checked={dialect === id}
          onClick={() => setDialect(id)}
          className={`flex-1 rounded-full font-medium transition-colors ${
            compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
          } ${
            dialect === id
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {DIALECT_LABELS[id]}
        </button>
      ))}
    </div>
  );
};

export default DialectToggle;
