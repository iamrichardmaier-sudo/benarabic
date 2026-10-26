import { useMemo, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import SpeakButton from '@/components/SpeakButton';
import type { FlashCard } from '@/lib/spaced-repetition';
import { Slider } from '@/components/ui/slider';
import { chunkWords, isCorrectOrder, readPieces, savePieces, shuffleTiles, tokenize } from '@/lib/sentence-order';

interface SentenceOrderProps {
  card: FlashCard;
  /** How many correct orderings in a row it takes to pass. */
  rounds?: number;
  /** Called once: true when every round was ordered correctly, false on the first miss. */
  onDone: (correct: boolean) => void;
}

/**
 * A sentence card's exercise: the English is the question, the Arabic words
 * are tiles, and the learner taps them into order.
 *
 * It replaces both multiple choice and typing for sentences — a sentence is
 * not recognised in one glance or typed from memory in one go, but its word
 * order is exactly what is worth drilling. With `rounds` above one the same
 * sentence comes back with the tiles reshuffled, so a lucky first answer
 * cannot pass it.
 *
 * Declared at module level, and keyed by the caller, so moving on to the next
 * card gives it a fresh state.
 */
const SentenceOrder = ({ card, rounds = 1, onDone }: SentenceOrderProps) => {
  const sentence = card.wordVoweled || card.word;
  const words = useMemo(() => tokenize(sentence), [sentence]);

  // Chunk size: from one tile per word down to two pieces of the sentence.
  const canChunk = words.length > 2;
  const [pieces, setPieces] = useState(() => {
    const saved = readPieces();
    return saved === 'all' ? words.length : Math.min(saved, words.length);
  });
  const chunks = useMemo(() => chunkWords(words, pieces), [words, pieces]);

  const [round, setRound] = useState(1);
  const [tiles, setTiles] = useState(() => shuffleTiles(chunks));
  const [placed, setPlaced] = useState<number[]>([]);
  const [result, setResult] = useState<'idle' | 'right' | 'wrong'>('idle');

  const open = result === 'idle';

  const place = (i: number) => {
    if (open && !placed.includes(i)) setPlaced((p) => [...p, i]);
  };
  const unplace = (position: number) => {
    if (open) setPlaced((p) => p.filter((_, at) => at !== position));
  };
  const clear = () => open && setPlaced([]);

  const check = () => {
    const ok = isCorrectOrder(placed.map((i) => tiles[i]), sentence);
    setResult(ok ? 'right' : 'wrong');
  };

  const proceed = () => {
    if (result === 'wrong') return onDone(false);
    if (round < rounds) {
      setRound((r) => r + 1);
      setTiles(shuffleTiles(chunks));
      setPlaced([]);
      setResult('idle');
      return;
    }
    onDone(true);
  };

  const changePieces = (next: number) => {
    if (!open || next === pieces) return;
    setPieces(next);
    savePieces(next >= words.length ? 'all' : next);
    setTiles(shuffleTiles(chunkWords(words, next)));
    setPlaced([]);
  };

  const lastRound = round >= rounds;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card flashcard-shadow border border-border/50 p-6 text-center space-y-2">
        {rounds > 1 && (
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Round {round} of {rounds}
          </p>
        )}
        <p className="text-xl text-foreground leading-snug">{card.english || '—'}</p>
        <p className="text-xs text-muted-foreground">Tap the words in order, right to left.</p>
      </div>

      {canChunk && (
        <div className="space-y-1.5 px-1">
          <div className="flex items-baseline justify-between text-xs text-muted-foreground">
            <span>Bigger chunks</span>
            <span className="font-medium text-foreground tabular-nums">
              {pieces >= words.length ? 'Every word' : `${pieces} pieces`}
            </span>
            <span>Every word</span>
          </div>
          <Slider
            dir="ltr"
            min={2}
            max={words.length}
            step={1}
            value={[pieces]}
            onValueChange={([v]) => changePieces(v)}
            disabled={!open}
            thumbLabel="Chunk size"
            thumbValueText={pieces >= words.length ? 'Every word' : `${pieces} pieces`}
          />
        </div>
      )}

      <div
        aria-label="Your sentence"
        dir="rtl"
        className="flex min-h-[4.5rem] flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 p-3"
      >
        {placed.map((tileIndex, position) => (
          <button
            key={`${tileIndex}-${position}`}
            onClick={() => unplace(position)}
            disabled={!open}
            className="font-arabic rounded-xl bg-primary px-3 py-2 text-xl text-primary-foreground transition-all active:scale-95"
          >
            {tiles[tileIndex]}
          </button>
        ))}
        {placed.length === 0 && (
          <span dir="ltr" className="px-1 text-sm text-muted-foreground">Your sentence goes here</span>
        )}
      </div>

      <div aria-label="Word bank" dir="rtl" className="flex flex-wrap justify-center gap-2">
        {tiles.map((tile, i) => (
          <button
            key={`${tile}-${i}`}
            onClick={() => place(i)}
            disabled={!open || placed.includes(i)}
            className="font-arabic rounded-xl bg-secondary px-3 py-2 text-xl text-secondary-foreground transition-all active:scale-95 disabled:opacity-25"
          >
            {tile}
          </button>
        ))}
      </div>

      {open && (
        <div className="flex gap-2">
          <button
            onClick={clear}
            disabled={placed.length === 0}
            aria-label="Clear"
            className="flex items-center justify-center rounded-xl border border-border px-4 py-3 text-muted-foreground transition-all active:scale-95 disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={check}
            disabled={placed.length !== tiles.length}
            className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-all active:scale-95 disabled:opacity-40"
          >
            Check
          </button>
        </div>
      )}

      {result === 'right' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 p-4">
            <Check className="h-6 w-6 shrink-0 text-success" />
            <span className="font-semibold text-success">Correct!</span>
          </div>
          <button
            onClick={proceed}
            className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-all active:scale-95"
          >
            {lastRound ? 'Continue' : 'Next round'}
          </button>
        </div>
      )}

      {result === 'wrong' && (
        <div className="space-y-3">
          <div className="space-y-2 rounded-xl border border-warning/30 bg-warning/10 p-4">
            <div className="flex items-center gap-2">
              <X className="h-5 w-5 shrink-0 text-warning" />
              <span className="font-semibold text-warning">Not quite. The sentence is:</span>
            </div>
            <div className="flex items-center gap-2" dir="rtl">
              <p className="font-arabic flex-1 text-xl font-semibold text-foreground">{sentence}</p>
              <SpeakButton word={sentence} size={18} autoSpeak />
            </div>
          </div>
          <button
            onClick={proceed}
            className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-all active:scale-95"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
};

export default SentenceOrder;
