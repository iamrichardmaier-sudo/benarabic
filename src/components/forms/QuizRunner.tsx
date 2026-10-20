import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { Question } from '@/lib/verb-forms/quiz';
import { formsTable } from '@/lib/verb-forms/data';
import ExplanationCard from '@/components/forms/ExplanationCard';

interface QuizRunnerProps {
  title: string;
  mode: 'identify' | 'meanings';
  level?: number;
  questions: Question[];
  onExit: () => void;
  /** Shown on the results screen under the score. */
  note?: string;
}

/**
 * One engine for every Forms quiz: a prompt, a row of options, then the
 * explanation card, then the next question. Only the questions differ.
 */
const QuizRunner = ({ title, mode, level, questions, onExit, note }: QuizRunnerProps) => {
  const [round, setRound] = useState(questions);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [missed, setMissed] = useState<Question[]>([]);
  const [score, setScore] = useState(0);
  const saved = useRef(false);

  const q = round[index];
  const done = index >= round.length;

  useEffect(() => {
    if (!done || saved.current || round.length === 0 || round !== questions) return;
    saved.current = true;
    // History is a convenience; a failed save never interrupts the learner.
    void formsTable('form_quiz_results')
      .insert({
        mode,
        level: level ?? null,
        score,
        total: round.length,
        missed: missed.map((m) => ({ root: m.explanation.root, form: m.explanation.form })),
      } as never)
      .then(() => undefined, () => undefined);
  }, [done, mode, level, score, round, questions, missed]);

  const choose = (id: string) => {
    if (picked) return;
    setPicked(id);
    if (id === q.answer) setScore((s) => s + 1);
    else setMissed((m) => [...m, q]);
  };

  const next = () => {
    setPicked(null);
    setIndex((i) => i + 1);
  };

  const retryMissed = () => {
    setRound(missed);
    setMissed([]);
    setScore(0);
    setIndex(0);
    setPicked(null);
  };

  if (round.length === 0) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">There are no questions to ask yet.</p>
        <button onClick={onExit} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
          Back
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-5">
        <div className="space-y-1 text-center">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-4xl font-bold text-primary">
            {score}/{round.length}
          </p>
          {note && <p className="text-sm text-muted-foreground">{note}</p>}
        </div>
        {missed.length > 0 && (
          <section className="space-y-2">
            <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">To revisit</h3>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {missed.map((m) => (
                <li key={m.id} className="flex items-baseline justify-between gap-3 px-4 py-3">
                  <span className="font-arabic text-lg" dir="rtl">{m.explanation.past}</span>
                  <span className="text-sm text-muted-foreground">Form {m.explanation.form}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          {missed.length > 0 && (
            <button onClick={retryMissed} className="rounded-xl border border-primary px-4 py-2.5 text-sm font-semibold text-primary">
              Retry the {missed.length} I missed
            </button>
          )}
          <button onClick={onExit} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
            Done
          </button>
        </div>
      </div>
    );
  }

  const right = picked === q.answer;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{title}</span>
          <span>{index + 1} / {round.length}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${(index / round.length) * 100}%` }} />
        </div>
      </div>

      <div className="space-y-1 rounded-2xl border border-border bg-card px-4 py-8 text-center">
        <p className={`text-4xl ${q.arabic ? 'font-arabic' : ''}`} dir={q.arabic ? 'rtl' : undefined}>
          {q.prompt}
        </p>
        {q.hint && <p className="text-xs text-muted-foreground">{q.hint}</p>}
      </div>

      <div className={q.kind === 'identify' ? 'grid grid-cols-5 gap-2' : 'space-y-2'}>
        {q.options.map((o) => {
          const isAnswer = o.id === q.answer;
          const state = !picked
            ? 'border-border bg-card hover:bg-muted/50'
            : isAnswer
              ? 'border-emerald-500 bg-emerald-500/10 text-foreground'
              : o.id === picked
                ? 'border-destructive bg-destructive/10 text-foreground'
                : 'border-border bg-card opacity-60';
          return (
            <button
              key={o.id}
              onClick={() => choose(o.id)}
              disabled={picked !== null}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${state}`}
            >
              {picked && isAnswer && <Check className="h-4 w-4 text-emerald-600" />}
              {picked && o.id === picked && !isAnswer && <X className="h-4 w-4 text-destructive" />}
              <span>{o.label}</span>
            </button>
          );
        })}
      </div>

      {picked && (
        <div className="space-y-3">
          <p role="status" className={`text-sm font-semibold ${right ? 'text-emerald-600' : 'text-destructive'}`}>
            {right ? 'Correct' : `Not quite — it is Form ${q.explanation.form}`}
          </p>
          <ExplanationCard e={q.explanation} />
          <button onClick={next} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">
            {index + 1 === round.length ? 'See results' : 'Next'}
          </button>
        </div>
      )}
    </div>
  );
};

export default QuizRunner;
