import { useState } from 'react';
import { FlashCard } from '@/lib/spaced-repetition';
import { BookText, Loader2, Sparkles, Trash2, ArrowLeft, ArrowRight, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const SENTENCES_KEY = 'arabic-practice-sentences';

type SentenceLength = 'short' | 'medium' | 'long';

function getLearnedWords(cards: FlashCard[]): string[] {
  return cards
    .filter((c) => c.easeFactor > 1.5 || c.intervalDays >= 3)
    .map((c) => c.word);
}

function loadSentences(): string[] {
  try {
    const data = localStorage.getItem(SENTENCES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveSentences(sentences: string[]): void {
  localStorage.setItem(SENTENCES_KEY, JSON.stringify(sentences));
}

interface ReadingPracticeProps {
  cards: FlashCard[];
  onBack: () => void;
}

const ReadingPractice = ({ cards, onBack }: ReadingPracticeProps) => {
  const [phase, setPhase] = useState<'setup' | 'loading' | 'reading'>('setup');
  const [sentenceLength, setSentenceLength] = useState<SentenceLength>('medium');
  const [sentenceCount, setSentenceCount] = useState(5);
  const [sentences, setSentences] = useState<string[]>(loadSentences());
  const [currentIdx, setCurrentIdx] = useState(0);
  const { toast } = useToast();

  const learnedWords = getLearnedWords(cards);
  const hasEnoughWords = learnedWords.length >= 10;
  const hasCached = sentences.length > 0;

  const handleGenerate = async () => {
    setPhase('loading');
    try {
      const { data, error } = await supabase.functions.invoke('generate-sentences', {
        body: { words: learnedWords, sentenceLength, sentenceCount },
      });

      if (error) throw new Error(error.message);
      if (data?.error) {
        toast({ title: data.error, variant: 'destructive' });
        setPhase('setup');
        return;
      }

      const generated = data.sentences || [];
      if (generated.length === 0) {
        toast({ title: 'No sentences generated', variant: 'destructive' });
        setPhase('setup');
        return;
      }

      setSentences(generated);
      saveSentences(generated);
      setCurrentIdx(0);
      setPhase('reading');
    } catch (err) {
      console.error(err);
      toast({ title: 'Error generating sentences', variant: 'destructive' });
      setPhase('setup');
    }
  };

  const clearSentences = () => {
    setSentences([]);
    localStorage.removeItem(SENTENCES_KEY);
    toast({ title: 'Sentences cleared' });
  };

  const startReading = () => {
    setCurrentIdx(0);
    setPhase('reading');
  };

  // Reading phase
  if (phase === 'reading' && sentences.length > 0) {
    const isLast = currentIdx >= sentences.length - 1;
    return (
      <div className="w-full max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => setPhase('setup')} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
          <span className="text-sm text-muted-foreground">{currentIdx + 1} / {sentences.length}</span>
        </div>

        <div className="rounded-2xl bg-card flashcard-shadow border border-border/50 p-8 min-h-[220px] flex items-center justify-center">
          <p className="font-arabic text-3xl font-semibold text-foreground leading-relaxed text-center" dir="rtl">
            {sentences[currentIdx]}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
            className="flex-1 py-3 rounded-xl bg-secondary text-secondary-foreground font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40"
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </button>
          {isLast ? (
            <button
              onClick={onBack}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              Done
            </button>
          ) : (
            <button
              onClick={() => setCurrentIdx((i) => i + 1)}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Loading phase
  if (phase === 'loading') {
    return (
      <div className="w-full max-w-md mx-auto text-center py-16 space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Generating sentences...</p>
      </div>
    );
  }

  // Setup phase
  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="text-center space-y-2">
        <BookText className="w-10 h-10 text-primary mx-auto" />
        <h2 className="text-xl font-bold text-foreground">Reading Practice</h2>
        <p className="text-sm text-muted-foreground">
          Generate Arabic sentences using your learned vocabulary ({learnedWords.length} words eligible)
        </p>
      </div>

      {!hasEnoughWords && (
        <div className="rounded-xl bg-warning/10 border border-warning/30 p-4 text-center">
          <p className="text-sm text-warning font-medium">
            You need at least 10 learned words to use this feature. Keep reviewing!
          </p>
        </div>
      )}

      {hasEnoughWords && (
        <>
          {/* Sentence length */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Sentence Length</label>
            <div className="grid grid-cols-3 gap-2">
              {(['short', 'medium', 'long'] as const).map((len) => (
                <button
                  key={len}
                  onClick={() => setSentenceLength(len)}
                  className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    sentenceLength === len
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {len === 'short' ? 'Short (5-7)' : len === 'medium' ? 'Medium (8-12)' : 'Long (13-18)'}
                </button>
              ))}
            </div>
          </div>

          {/* Sentence count */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Number of Sentences</label>
            <div className="grid grid-cols-3 gap-2">
              {[5, 10, 15].map((n) => (
                <button
                  key={n}
                  onClick={() => setSentenceCount(n)}
                  className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    sentenceCount === n
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {n} sentences
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            Generate Sentences
          </button>

          {hasCached && (
            <div className="space-y-2">
              <button
                onClick={startReading}
                className="w-full py-3 rounded-xl bg-secondary text-secondary-foreground font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <BookText className="w-4 h-4" />
                Re-read Previous ({sentences.length} sentences)
              </button>
              <button
                onClick={clearSentences}
                className="w-full py-2.5 rounded-xl text-sm text-muted-foreground hover:text-destructive flex items-center justify-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear old sentences
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReadingPractice;
