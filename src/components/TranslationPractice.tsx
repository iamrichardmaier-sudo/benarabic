import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Languages, Loader2, Flag, ShieldCheck, ShieldAlert, Lightbulb, RotateCcw } from 'lucide-react';
import BackButton from '@/components/BackButton';
import ArabicDictation, { dictationSupported } from '@/components/ArabicDictation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  loadToday, gradeAttempt, flagAttempt, isCorrection, solved, otherWays, VERDICT_LABEL,
  type Attempt, type Challenge, type WordNote, type Verdict,
} from '@/lib/translation-practice';

interface TranslationPracticeProps {
  onBack: () => void;
  /** Where Back goes: Learn, or Home when opened from the daily prompt. */
  backLabel?: string;
}

const VERDICT_STYLE: Record<Verdict, string> = {
  correct: 'border-success/40 bg-success/10 text-success',
  minor: 'border-warning/40 bg-warning/10 text-warning',
  errors: 'border-destructive/40 bg-destructive/5 text-destructive',
  meaning: 'border-destructive/40 bg-destructive/5 text-destructive',
};

const STATUS_LABEL: Record<WordNote['status'], string> = {
  ok: 'Correct',
  fix: 'Change',
  add: 'Missing',
  remove: 'Remove',
  alternative: 'Also correct',
};

const STATUS_STYLE: Record<WordNote['status'], string> = {
  ok: 'text-success',
  fix: 'text-destructive',
  add: 'text-destructive',
  remove: 'text-destructive',
  alternative: 'text-primary',
};

/**
 * Three hard English sentences a day, built from the learner's newest words,
 * to translate into Arabic. Any correct wording counts: the feedback finds
 * the correct sentence nearest to what was written and goes through it word
 * by word, and every correction has been checked a second time before it is
 * shown as an error.
 */
const TranslationPractice = ({ onBack, backLabel = 'Learn' }: TranslationPracticeProps) => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    loadToday()
      .then((r) => {
        setChallenges(r.challenges);
        setAttempts(r.attempts);
        // Open on the first sentence not yet translated correctly.
        const open = r.challenges.findIndex((c) => !solved(r.attempts.filter((a) => a.challenge_id === c.id)));
        setCurrent(open === -1 ? 0 : open);
      })
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const header = (
    <>
      <BackButton label={backLabel} onClick={onBack} />
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Daily translation</h1>
        <p className="text-sm text-muted-foreground">
          Three hard sentences from your newest words. Any correct Arabic counts.
        </p>
      </div>
    </>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {header}
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Getting today’s sentences…
        </div>
      </div>
    );
  }

  if (loadError || challenges.length === 0) {
    return (
      <div className="space-y-4">
        {header}
        <div className="rounded-xl border border-border/60 bg-card p-6 text-center">
          <Languages className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
          <p className="font-medium text-foreground">Today’s sentences could not be loaded</p>
          <p className="mt-1 text-sm text-muted-foreground">{loadError ?? 'Nothing came back.'}</p>
          <Button className="mt-4" variant="outline" onClick={load}>Try again</Button>
        </div>
      </div>
    );
  }

  const challenge = challenges[current];
  const mine = attempts.filter((a) => a.challenge_id === challenge.id);

  return (
    <div className="space-y-5">
      {header}

      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Today’s sentences">
        {challenges.map((c, i) => {
          const done = solved(attempts.filter((a) => a.challenge_id === c.id));
          const tried = attempts.some((a) => a.challenge_id === c.id);
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={i === current}
              onClick={() => setCurrent(i)}
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                i === current ? 'border-primary bg-primary/5 text-foreground' : 'border-border/60 bg-card text-muted-foreground hover:bg-muted/40'
              }`}
            >
              {done ? <Check className="h-4 w-4 text-success" /> : <span>{i + 1}</span>}
              <span className="sr-only sm:not-sr-only">{done ? 'Done' : tried ? 'Tried' : `Sentence`}</span>
            </button>
          );
        })}
      </div>

      <ChallengeCard
        key={challenge.id}
        challenge={challenge}
        attempts={mine}
        onGraded={(a) => setAttempts((all) => [...all, a])}
        onFlagged={(id) => setAttempts((all) => all.map((a) => (a.id === id ? { ...a, flagged: true } : a)))}
        onNext={current < challenges.length - 1 ? () => setCurrent(current + 1) : undefined}
      />
    </div>
  );
};

interface ChallengeCardProps {
  challenge: Challenge;
  attempts: Attempt[];
  onGraded: (attempt: Attempt) => void;
  onFlagged: (id: string) => void;
  onNext?: () => void;
}

const ChallengeCard = ({ challenge, attempts, onGraded, onFlagged, onNext }: ChallengeCardProps) => {
  const [text, setText] = useState('');
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const latest = attempts[attempts.length - 1];
  // After an attempt the feedback shows until the learner chooses to try again.
  const [retrying, setRetrying] = useState(false);
  const showFeedback = latest && !retrying;

  const submit = async () => {
    const attempt = text.trim();
    if (!attempt || grading) return;
    setGrading(true);
    setError(null);
    try {
      onGraded(await gradeAttempt(challenge.id, attempt));
      setRetrying(false);
      setText('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGrading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Translate into Arabic</p>
        <p className="text-lg leading-relaxed text-foreground">{challenge.english}</p>
        {showHint ? (
          <div className="space-y-1 rounded-xl bg-muted/50 p-3 text-sm">
            {challenge.grammar_focus && (
              <p><span className="text-muted-foreground">Grammar: </span>
                <span className="font-arabic text-foreground" dir="auto">{challenge.grammar_focus}</span></p>
            )}
            {challenge.target_words.length > 0 && (
              <p><span className="text-muted-foreground">Your words: </span>
                <span className="font-arabic text-foreground" dir="rtl" lang="ar">{challenge.target_words.join('، ')}</span></p>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowHint(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <Lightbulb className="h-4 w-4" /> Show hint
          </button>
        )}
      </div>

      {showFeedback ? (
        <>
          <FeedbackView challenge={challenge} attempt={latest} onFlagged={onFlagged} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setRetrying(true)}>
              <RotateCcw className="me-1.5 h-4 w-4" /> Try another way
            </Button>
            {onNext && <Button onClick={onNext}>Next sentence</Button>}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {dictationSupported() && (
            <p className="text-sm text-muted-foreground">
              Write your translation by hand, then tap <span className="font-medium text-foreground">Read it aloud</span> and
              read it off. Check the text below matches what you wrote before checking it: voice recognition
              sometimes quietly corrects a mistake or mishears a word.
            </p>
          )}
          <ArabicDictation
            disabled={grading}
            onText={(said) => setText((t) => (t.trim() ? `${t.trim()} ${said}` : said))}
          />
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            dir="rtl"
            lang="ar"
            rows={4}
            maxLength={600}
            placeholder="اكتب ترجمتك هنا…"
            aria-label="Your Arabic translation"
            className="font-arabic text-xl leading-loose"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
            }}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={submit} disabled={!text.trim() || grading}>
              {grading ? <><Loader2 className="me-1.5 h-4 w-4 animate-spin" /> Checking…</> : 'Check my translation'}
            </Button>
            {retrying && <Button variant="ghost" onClick={() => setRetrying(false)}>Back to feedback</Button>}
          </div>
        </div>
      )}

      {attempts.length > 1 && (
        <details className="rounded-xl border border-border/60 bg-card p-3 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">Earlier attempts ({attempts.length - 1})</summary>
          <ul className="mt-2 space-y-2">
            {attempts.slice(0, -1).map((a) => (
              <li key={a.id} className="flex items-baseline justify-between gap-3">
                <span className="font-arabic text-base text-foreground" dir="rtl" lang="ar">{a.attempt}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{VERDICT_LABEL[a.feedback.verdict]}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

const FeedbackView = ({ challenge, attempt, onFlagged }: {
  challenge: Challenge;
  attempt: Attempt;
  onFlagged: (id: string) => void;
}) => {
  const f = attempt.feedback;
  const others = useMemo(() => otherWays(challenge, f), [challenge, f]);
  const corrections = f.words.filter((w) => isCorrection(w.status)).length;

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-4 ${VERDICT_STYLE[f.verdict]}`}>
        <p className="font-semibold">{VERDICT_LABEL[f.verdict]}</p>
        {f.summary && <p className="mt-1 text-sm text-foreground">{f.summary}</p>}
      </div>

      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">You wrote</p>
        <p className="font-arabic text-xl leading-loose text-foreground" dir="rtl" lang="ar">{attempt.attempt}</p>
        {corrections > 0 && f.closest_correct && (
          <>
            <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Closest correct version</p>
            <p className="font-arabic text-xl leading-loose text-success" dir="rtl" lang="ar">{f.closest_correct}</p>
          </>
        )}
      </section>

      {f.words.length > 0 && (
        <section className="space-y-2" aria-label="Word by word">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Word by word</h2>
          <ol className="divide-y divide-border/60 rounded-2xl border border-border bg-card">
            {f.words.map((w, i) => <WordRow key={i} w={w} />)}
          </ol>
        </section>
      )}

      {f.tips.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tips for you</h2>
          <ul className="list-disc space-y-1 ps-5 text-sm text-foreground">
            {f.tips.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </section>
      )}

      {others.length > 0 && (
        <details className="rounded-2xl border border-border bg-card p-4">
          <summary className="cursor-pointer text-sm font-medium text-foreground">Other correct ways to say it ({others.length + 1})</summary>
          <ul className="mt-3 space-y-2">
            {[f.closest_reference, ...others].filter(Boolean).map((r) => (
              <li key={r} className="font-arabic text-lg leading-loose text-foreground" dir="rtl" lang="ar">{r}</li>
            ))}
          </ul>
        </details>
      )}

      <Trust attempt={attempt} onFlagged={onFlagged} />
    </div>
  );
};

const WordRow = ({ w }: { w: WordNote }) => {
  const changed = isCorrection(w.status);
  return (
    <li className="space-y-1 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-arabic text-lg" dir="rtl" lang="ar">
          {w.status === 'add' ? (
            <span className="text-success">+ {w.correct}</span>
          ) : changed ? (
            <>
              <span className="text-destructive line-through decoration-1">{w.yours}</span>
              {w.status === 'fix' && <> ← <span className="text-success">{w.correct}</span></>}
            </>
          ) : (
            <span className="text-foreground">{w.yours}</span>
          )}
        </span>
        <span className={`text-xs font-semibold ${STATUS_STYLE[w.status]}`}>{STATUS_LABEL[w.status]}</span>
      </div>
      {w.rule && changed && <p className="text-sm font-medium text-foreground">{w.rule}</p>}
      {w.note && <p className="text-sm text-muted-foreground">{w.note}</p>}
    </li>
  );
};

/** How far the feedback was checked, and a way to say it is wrong. */
const Trust = ({ attempt, onFlagged }: { attempt: Attempt; onFlagged: (id: string) => void }) => {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const f = attempt.feedback;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await flagAttempt(attempt.id, note.trim());
      onFlagged(attempt.id);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 text-sm">
      <p className="flex items-start gap-2 text-muted-foreground">
        {f.exact_match ? (
          <><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /> Matches a stored correct translation exactly.</>
        ) : f.verified ? (
          <><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /> Every correction was checked a second time. AI can still be wrong now and then.</>
        ) : (
          <><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" /> The second check could not run, so treat these corrections with care.</>
        )}
      </p>
      {attempt.flagged ? (
        <p className="flex items-center gap-2 text-muted-foreground"><Flag className="h-4 w-4" /> You marked this feedback as wrong. It won’t count toward your weak spots.</p>
      ) : open ? (
        <div className="space-y-2 rounded-xl border border-border/60 bg-card p-3">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="What looks wrong? (optional)"
            aria-label="What looks wrong"
          />
          {error && <p className="text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>Mark as wrong</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground">
          <Flag className="h-4 w-4" /> This feedback seems wrong
        </button>
      )}
    </div>
  );
};

export default TranslationPractice;
