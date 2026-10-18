import { useMemo, useState } from 'react';
import QuizRunner from '@/components/forms/QuizRunner';
import HeatMap from '@/components/forms/HeatMap';
import type { FlashCard } from '@/lib/spaced-repetition';
import { groupByRoot, type Conjugation } from '@/lib/verb-forms/data';
import { buildMeanings, shuffle } from '@/lib/verb-forms/quiz';
import type { FormId } from '@/lib/verb-forms/generate';
import { rootKey } from '@/lib/word-relations';

interface HeatMapFlowProps {
  cards: FlashCard[];
  rows: Conjugation[];
  rootMeanings: Record<string, string>;
  onExit: () => void;
}

const SESSION = 10;

/**
 * Flashcards from the learner's own verbs. The back of each card is the heat
 * map for its root; afterwards a short quiz asks what a root's form means.
 */
const HeatMapFlow = ({ cards, rows, rootMeanings, onExit }: HeatMapFlowProps) => {
  const byRoot = useMemo(() => groupByRoot(rows), [rows]);
  const deck = useMemo(() => {
    const seen = new Set<string>();
    const mine = cards.filter((c) => {
      if (c.wordType !== 'verb' || !c.root) return false;
      const k = rootKey(c.root);
      if (seen.has(k) || !byRoot.has(k)) return false;
      seen.add(k);
      return true;
    });
    return shuffle(mine).slice(0, SESSION);
  }, [cards, byRoot]);

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [phase, setPhase] = useState<'cards' | 'quiz'>('cards');

  const questions = useMemo(
    () =>
      phase === 'quiz'
        ? buildMeanings(rows, {
            keyOf: rootKey,
            count: 8,
            hideVerb: true,
            roots: new Set(deck.map((c) => rootKey(c.root!))),
            rootMeanings,
          })
        : [],
    [phase, rows, deck, rootMeanings],
  );

  if (deck.length === 0) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          None of your verbs have a stored paradigm yet. Tag a verb with its root and form, and it shows up here.
        </p>
        <button onClick={onExit} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Back</button>
      </div>
    );
  }

  if (phase === 'quiz') {
    return (
      <QuizRunner
        title="Root and form"
        mode="heatmap"
        questions={questions}
        onExit={onExit}
        note={questions.length === 0 ? 'Not enough forms with meanings on these roots to ask about yet.' : undefined}
      />
    );
  }

  const card = deck[index];
  const rootRows = byRoot.get(rootKey(card.root!)) ?? [];
  const last = index === deck.length - 1;

  return (
    <div className="space-y-4">
      <p className="text-center text-xs text-muted-foreground">{index + 1} / {deck.length}</p>
      <button
        onClick={() => setFlipped((f) => !f)}
        className="w-full space-y-3 rounded-2xl border border-border bg-card px-4 py-8 text-center"
        aria-label={flipped ? 'Show the verb' : 'Show where this root is used'}
      >
        {!flipped ? (
          <>
            <p className="font-arabic text-4xl" dir="rtl">{card.wordVoweled || card.word}</p>
            <p className="text-xs text-muted-foreground">Tap to see the root’s ten forms</p>
          </>
        ) : (
          <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-foreground">
              <span className="font-arabic text-lg" dir="rtl">{card.root}</span>
              {rootMeanings[card.root!] ? ` · ${rootMeanings[card.root!]}` : ''}
              {card.verbForm ? ` · yours is Form ${card.verbForm}` : ''}
            </p>
            <HeatMap rows={rootRows} mine={(card.verbForm as FormId | null) ?? null} />
          </div>
        )}
      </button>
      <div className="flex gap-2">
        <button
          disabled={index === 0}
          onClick={() => { setIndex(index - 1); setFlipped(false); }}
          className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold disabled:opacity-40"
        >
          Back
        </button>
        <button
          onClick={() => {
            if (last) setPhase('quiz');
            else { setIndex(index + 1); setFlipped(false); }
          }}
          className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
        >
          {last ? 'Quiz me' : 'Next'}
        </button>
      </div>
    </div>
  );
};

export default HeatMapFlow;
