import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

// The Web Speech API is not in TypeScript's DOM types; this is the slice used.
interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const dictationSupported = () => recognitionCtor() !== null;

const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access was blocked. Allow it in your browser settings to read your answer aloud.',
  'service-not-allowed': 'Microphone access was blocked. Allow it in your browser settings to read your answer aloud.',
  'no-speech': 'Nothing was heard. Tap the mic and read your sentence again.',
  'audio-capture': 'No microphone was found.',
  network: 'Voice recognition needs an internet connection.',
};

interface ArabicDictationProps {
  /** Called with each finished stretch of speech, to add to the answer. */
  onText: (text: string) => void;
  disabled?: boolean;
}

/**
 * A microphone button for reading an Arabic answer aloud: the learner writes
 * the sentence by hand, then reads it off, and what is heard is typed into the
 * answer box to check and correct before grading.
 *
 * Runs on the browser's own speech recognition (Chrome, Edge, Safari), so it
 * costs nothing; where the browser has none, the button is not shown.
 */
const ArabicDictation = ({ onText, disabled }: ArabicDictationProps) => {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  // Stop listening if the screen goes away mid-sentence.
  useEffect(() => () => recognition.current?.abort(), []);

  const Ctor = recognitionCtor();
  if (!Ctor) return null;

  const start = () => {
    setError(null);
    const r = new Ctor();
    r.lang = 'ar-SA';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const said = res[0].transcript.trim();
        if (res.isFinal) { if (said) onTextRef.current(said); }
        else live += `${said} `;
      }
      setInterim(live.trim());
    };
    r.onerror = (e) => {
      if (e.error !== 'aborted') setError(ERRORS[e.error] ?? 'Voice recognition stopped. Tap the mic to try again.');
    };
    r.onend = () => {
      setListening(false);
      setInterim('');
      recognition.current = null;
    };
    recognition.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setError('Voice recognition could not start. Tap the mic to try again.');
    }
  };

  const stop = () => recognition.current?.stop();

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={listening ? 'default' : 'outline'}
        onClick={listening ? stop : start}
        disabled={disabled}
        aria-pressed={listening}
      >
        {listening
          ? <><Square className="me-1.5 h-4 w-4" /> Stop listening</>
          : <><Mic className="me-1.5 h-4 w-4" /> Read it aloud</>}
      </Button>
      {listening && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
          Listening… read your sentence in Arabic.
          {interim && <span className="font-arabic text-base text-foreground" dir="rtl" lang="ar">{interim}</span>}
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
};

export default ArabicDictation;
