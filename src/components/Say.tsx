import type { ReactNode } from 'react';
import { Volume2 } from 'lucide-react';
import { playSpeech, type SpeechVoice } from '@/lib/speech';

interface SayProps {
  /** What is said. Defaults to the children when they are plain text. */
  text?: string | null;
  voice?: SpeechVoice;
  /** A small speaker after the text, where a line needs to look tappable. */
  icon?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Arabic that says itself when tapped.
 *
 * The rule across the app is that any Arabic on screen can be heard. A
 * speaker button beside every word in a table of forty would bury the table,
 * so the text itself is the button: tap a form, hear it.
 *
 * A span and not a button, because it sits inside rows and cards that are
 * themselves buttons; the tap stops here so hearing a word does not also
 * flip the card or open the row.
 */
const Say = ({ text, voice = 'ar', icon = false, className = '', children }: SayProps) => {
  const line = (text ?? (typeof children === 'string' ? children : '')).trim();
  // Nothing to say (an em dash for a missing form): plain text, not a dead button.
  if (!line || !/[؀-ۿ]/.test(line)) return <span className={className}>{children ?? text}</span>;

  const say = (e: { stopPropagation: () => void; preventDefault?: () => void }) => {
    e.stopPropagation();
    void playSpeech(line, { voice });
  };

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`Hear ${line}`}
      onClick={say}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          say(e);
        }
      }}
      className={`cursor-pointer rounded transition-colors hover:text-primary active:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${className}`}
    >
      {children ?? text}
      {icon && <Volume2 aria-hidden className="ms-1.5 inline h-3 w-3 align-middle text-muted-foreground/60" />}
    </span>
  );
};

export default Say;
