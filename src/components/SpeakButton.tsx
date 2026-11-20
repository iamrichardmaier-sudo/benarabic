import { useState, useCallback, useEffect, useRef } from 'react';
import { Volume2 } from 'lucide-react';
import { playSpeech, type SpeechVoice } from '@/lib/speech';

interface SpeakButtonProps {
  word: string;
  size?: number;
  className?: string;
  autoSpeak?: boolean;
  /** Which voice reads it: the Fusha narrator unless the text is Shaami. */
  voice?: SpeechVoice;
}

/** Say an Arabic word or line. See lib/speech for where the voice comes from. */
export function speakArabic(word: string, voice: SpeechVoice = 'ar'): Promise<void> {
  return playSpeech(word, { voice });
}

const SpeakButton = ({ word, size = 18, className = '', autoSpeak = false, voice = 'ar' }: SpeakButtonProps) => {
  const [speaking, setSpeaking] = useState(false);
  const hasAutoSpoken = useRef(false);

  const speak = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSpeaking(true);
    speakArabic(word, voice).finally(() => setSpeaking(false));
  }, [word, voice]);

  useEffect(() => {
    if (autoSpeak && !hasAutoSpoken.current) {
      hasAutoSpoken.current = true;
      // Small delay to let voices load
      const timer = setTimeout(() => speak(), 150);
      return () => clearTimeout(timer);
    }
  }, [autoSpeak, speak]);

  // Reset auto-speak ref when word changes
  useEffect(() => {
    hasAutoSpoken.current = false;
  }, [word]);

  return (
    <button
      onClick={speak}
      className={`inline-flex items-center justify-center p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${speaking ? 'text-primary animate-pulse' : ''} ${className}`}
      title="Listen"
      aria-label="Listen"
      type="button"
    >
      <Volume2 size={size} />
    </button>
  );
};

export default SpeakButton;
