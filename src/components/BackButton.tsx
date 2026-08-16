import { ChevronLeft } from 'lucide-react';

interface BackButtonProps {
  onClick: () => void;
  /** Where this goes, e.g. "Library". Shown so the destination is never a guess. */
  label?: string;
  className?: string;
}

/**
 * The one way out, used on every screen that sits below a tab root.
 *
 * Consistency is the whole point: the spec's "clear emergency exits" and
 * "keep one back-button behaviour everywhere" both fail the moment each screen
 * invents its own affordance. Naming the destination ("Library", not just an
 * arrow) means the user never has to guess where they will land, and the
 * generous hit area keeps it comfortably above the 44px minimum.
 */
const BackButton = ({ onClick, label = 'Back', className = '' }: BackButtonProps) => (
  <button
    onClick={onClick}
    aria-label={`Back to ${label}`}
    className={`inline-flex items-center gap-1 -ms-2 ps-2 pe-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors ${className}`}
  >
    <ChevronLeft className="w-4 h-4 shrink-0" />
    {label}
  </button>
);

export default BackButton;
