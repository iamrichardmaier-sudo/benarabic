import { useState, useCallback, useEffect, useRef } from 'react';
import { Volume2 } from 'lucide-react';

interface SpeakButtonProps {
  word: string;
  size?: number;
  className?: string;
  autoSpeak?: boolean;
}

let cachedVoice: SpeechSynthesisVoice | null = null;

function getArabicVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  const exact = voices.find(v => v.lang === 'ar-SA');
  const fallback = voices.find(v => v.lang.startsWith('ar'));
  cachedVoice = exact || fallback || null;
  return cachedVoice;
}

export function speakArabic(word: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'ar-SA';
  utterance.rate = 0.8;
  const voice = getArabicVoice();
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
  return utterance;
}

const SpeakButton = ({ word, size = 18, className = '', autoSpeak = false }: SpeakButtonProps) => {
  const [speaking, setSpeaking] = useState(false);
  const hasAutoSpoken = useRef(false);

  const speak = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.speechSynthesis) return;
    const utterance = speakArabic(word);
    if (!utterance) return;
    setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
  }, [word]);

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
      type="button"
    >
      <Volume2 size={size} />
    </button>
  );
};

export default SpeakButton;
