import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Ear, Keyboard, Rabbit, Split, Turtle, Volume2, X } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { playSpeech, preloadSpeech, type SpeechVoice } from '@/lib/speech';
import { pickDistractors, optionLabel } from '@/lib/distractors';
import { dialectView } from '@/lib/dialect';
import { usePreferences } from '@/hooks/usePreferences';
import {
  CONTRASTS, MINIMAL_PAIRS, checkDictation, dictationDiff, dictationTarget, type MinimalPair,
} from '@/lib/ear-training';
import { logReview } from '@/lib/review-log';
import { XP_LEARN } from '@/lib/levels';
import { isSentence, type FlashCard } from '@/lib/spaced-repetition';

type Mode = 'meaning' | 'dictation' | 'pairs';

interface EarTrainingProps {
  cards: FlashCard[];
  userId?: string;
  onBack: () => void;
  onEarn?: (amount: number) => void;
}

const ROUNDS = 12;
const SLOW = 0.65;

const MODES: { id: Mode; label: string; hint: string; icon: typeof Ear }[] = [
  { id: 'meaning', label: 'Hear it, know it', hint: 'A word from your deck is said, with nothing on screen. Pick what it means.', icon: Ear },
  { id: 'dictation', label: 'Dictation', hint: 'A word or sentence is said. Type what you hear; vowels are not graded.', icon: Keyboard },
  { id: 'pairs', label: 'Sound pairs', hint: 'Two words one sound apart. One is said: which was it?', icon: Split },
];

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** One question: what is said, in which voice, and what answers it. */
interface Round {
  id: string;
  say: string;
  voice: SpeechVoice;
  /** meaning: the English options. pairs: the two words. dictation: none. */
  options: { label: string; sub?: string; right: boolean; arabic?: boolean }[];
  /** dictation: the normalised spellings that count. */
  accept: string[];
  /** Shown once answered. */
  reveal: { arabic: string; english: string; note?: string };
}

/**
 * Ear training: three drills that all start from sound and not from text.
 *
 * Everything else in the app shows the word first and says it second, which
 * trains reading with an accompaniment. Here the text is withheld until the
 * answer is in. Nothing is rescheduled; answers go to the history.
 */
const EarTraining = ({ cards, userId, onBack, onEarn }: EarTrainingProps) => {
  const { dialect } = usePreferences();
  const [mode, setMode] = useState<Mode | null>(null);
  const [contrast, setContrast] = useState<string>('all');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<{ right: boolean; picked?: string; typed?: string } | null>(null);
  const [typed, setTyped] = useState('');
  const [score, setScore] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  // Words that are known come first: this trains the ear on words whose
  // meaning is not in question. A deck with too few learned words uses all of it.
  const words = useMemo(() => {
    const usable = cards.filter((c) => !isSentence(c) && c.english && (c.wordVoweled || c.word));
    const learned = usable.filter((c) => c.learningStage === 'graduated');
    return learned.length >= 8 ? learned : usable;
  }, [cards]);
  const sentences = useMemo(
    () => cards.filter((c) => isSentence(c) && c.word.trim().split(/\s+/).length <= 9),
    [cards],
  );

  const build = useCallback((m: Mode, which: string): Round[] => {
    if (m === 'pairs') {
      const pool = which === 'all' ? MINIMAL_PAIRS : MINIMAL_PAIRS.filter((p) => p.contrast === which);
      // A short list is gone through more than once, each time with a fresh coin toss.
      const picks: MinimalPair[] = [];
      while (picks.length < ROUNDS) picks.push(...shuffle(pool));
      return picks.slice(0, ROUNDS).map((p, i) => {
        const target = Math.random() < 0.5 ? p.a : p.b;
        const sides = Math.random() < 0.5 ? [p.a, p.b] : [p.b, p.a];
        return {
          id: `pair:${p.a.ar}|${p.b.ar}:${i}`,
          say: target.ar,
          voice: 'ar' as const,
          options: sides.map((s) => ({ label: s.ar, sub: s.en, right: s === target, arabic: true })),
          accept: [],
          reveal: { arabic: target.ar, english: target.en, note: p.hint },
        };
      });
    }
    if (m === 'meaning') {
      return shuffle(words).slice(0, ROUNDS).map((card) => {
        const view = dialectView(card, dialect);
        const right = optionLabel(card.english || '');
        const wrong = pickDistractors(card, words, 'english').map(optionLabel);
        return {
          id: card.id,
          say: view.spoken.split('/')[0].trim(),
          voice: view.voice,
          options: shuffle([{ label: right, right: true }, ...wrong.map((label) => ({ label, right: false }))]),
          accept: [],
          reveal: { arabic: view.headline, english: card.english || '' },
        };
      });
    }
    // Dictation: mostly single words, with the short sentences the deck holds mixed in.
    const some = shuffle(sentences).slice(0, Math.min(4, sentences.length));
    const picks = shuffle([...shuffle(words).slice(0, ROUNDS - some.length), ...some]);
    return picks.map((card) => {
      const view = dialectView(card, dialect);
      const t = dictationTarget(card, view.spoken);
      return {
        id: card.id,
        say: t.say,
        voice: view.voice,
        options: [],
        accept: t.accept,
        reveal: { arabic: t.say, english: card.english || '' },
      };
    });
  }, [words, sentences, dialect]);

  const start = (m: Mode, which = contrast) => {
    const next = build(m, which);
    setMode(m);
    setRounds(next);
    setIndex(0);
    setScore(0);
    setAnswered(null);
    setTyped('');
    // The lines of the session, fetched while the first is being answered.
    for (const voice of ['ar', 'ar-shami'] as const) {
      preloadSpeech(next.filter((r) => r.voice === voice).map((r) => r.say), voice);
    }
  };

  const round = rounds[index];
  const say = useCallback((rate = 1) => {
    if (round) void playSpeech(round.say, { voice: round.voice, rate });
  }, [round]);

  // Each question says itself as it arrives.
  useEffect(() => {
    if (!round) return;
    say();
    if (mode === 'dictation') input.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.id]);

  const settle = (right: boolean, extra: { picked?: string; typed?: string }) => {
    if (!round || !mode || answered) return;
    setAnswered({ right, ...extra });
    if (right) setScore((n) => n + 1);
    onEarn?.(
      mode === 'dictation'
        ? (right ? XP_LEARN.typedRight : XP_LEARN.typedWrong)
        : (right ? XP_LEARN.choiceRight : XP_LEARN.choiceWrong),
    );
    logReview(userId, {
      cardId: mode === 'pairs' ? round.id.replace(/:\d+$/, '') : round.id,
      kind: mode === 'meaning' ? 'listen' : mode,
      rating: right ? 'good' : 'again',
    });
  };

  const next = () => {
    setAnswered(null);
    setTyped('');
    setIndex((i) => i + 1);
  };

  useEffect(() => {
    if (!round) return;
    const onKey = (e: KeyboardEvent) => {
      if (answered && e.key === 'Enter') {
        e.preventDefault();
        next();
      } else if (!answered && mode !== 'dictation' && /^[1-4]$/.test(e.key)) {
        const option = round.options[Number(e.key) - 1];
        if (option) settle(option.right, { picked: option.label });
      } else if (mode !== 'dictation' && (e.key === 'r' || e.key === 'R')) {
        say();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.id, answered, mode]);

  // --- Choosing a drill -----------------------------------------------------
  if (!mode) {
    return (
      <div className="space-y-4">
        <BackButton onClick={onBack} label="Learn" />
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-foreground">Ear training</h1>
          <p className="text-sm text-muted-foreground">Sound first. The text stays hidden until you answer.</p>
        </div>
        <div className="space-y-2.5">
          {MODES.map((m) => {
            const blocked = m.id !== 'pairs' && words.length < 4;
            return (
              <button
                key={m.id}
                onClick={() => start(m.id)}
                disabled={blocked}
                className="flex w-full items-start gap-3 rounded-2xl border border-border bg-card p-4 text-start transition-all hover:border-primary/40 enabled:active:scale-[0.99] disabled:opacity-50"
              >
                <span className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary"><m.icon className="h-5 w-5" /></span>
                <span>
                  <span className="block font-semibold text-foreground">{m.label}</span>
                  <span className="block text-sm text-muted-foreground">
                    {blocked ? 'Needs a few words in your deck first.' : m.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sound pairs: which contrast</p>
          <div className="flex flex-wrap gap-1.5">
            {['all', ...CONTRASTS].map((c) => (
              <button
                key={c}
                onClick={() => setContrast(c)}
                aria-pressed={contrast === c}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  contrast === c ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                {c === 'all' ? 'All' : /[\u0600-\u06FF]/.test(c) ? <span className="font-arabic">{c}</span> : c}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- The end of a round ---------------------------------------------------
  if (!round) {
    return (
      <div className="space-y-4">
        <BackButton onClick={() => setMode(null)} label="Ear training" />
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
          <p className="text-4xl font-bold tabular-nums text-foreground">
            {score}<span className="text-muted-foreground">/{rounds.length}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {mode === 'pairs' && score / Math.max(1, rounds.length) < 0.75
              ? 'Guessing gets half. Under three in four means this contrast is worth another round.'
              : 'Done.'}
          </p>
          <button
            onClick={() => start(mode)}
            className="w-full rounded-xl bg-primary py-2.5 font-medium text-primary-foreground transition-all active:scale-95"
          >
            Another round
          </button>
        </div>
      </div>
    );
  }

  // For a sentence, which words were missed; for a single word that is the word itself, so only what was typed is shown.
  const diff = answered && mode === 'dictation' && !answered.right && answered.typed
    ? (round.say.includes(' ') ? dictationDiff(answered.typed, round.say) : { missing: [], extra: [answered.typed.trim()] })
    : null;

  return (
    <div className="space-y-4">
      <BackButton onClick={() => setMode(null)} label="Ear training" />

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{index + 1} / {rounds.length}</span>
        <span>{score} correct</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div className="h-1.5 rounded-full bg-primary transition-all duration-300" style={{ width: `${(index / rounds.length) * 100}%` }} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-4 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {mode === 'meaning' ? 'What does it mean?' : mode === 'dictation' ? 'Type what you hear' : 'Which word was said?'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => say()}
            aria-label="Play again"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-all active:scale-95"
          >
            <Volume2 className="h-7 w-7" />
          </button>
          <button
            onClick={() => say(SLOW)}
            aria-label="Play slowly"
            className="flex h-11 items-center gap-1.5 rounded-full border border-border px-3.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Turtle className="h-4 w-4" /> Slow
          </button>
          <button
            onClick={() => say(1.15)}
            aria-label="Play fast"
            className="flex h-11 items-center gap-1.5 rounded-full border border-border px-3.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Rabbit className="h-4 w-4" /> Fast
          </button>
        </div>

        {answered && (
          <div className="space-y-1">
            <p className="flex items-center justify-center gap-2 font-arabic text-3xl font-bold text-foreground" dir="rtl">
              {answered.right ? <Check className="h-6 w-6 text-success" /> : <X className="h-6 w-6 text-destructive" />}
              {round.reveal.arabic}
            </p>
            <p className="text-sm text-muted-foreground">{round.reveal.english}</p>
            {diff && (diff.missing.length > 0 || diff.extra.length > 0) && (
              <p className="text-xs text-muted-foreground">
                {diff.missing.length > 0 && <>Missed: <span className="font-arabic text-sm text-foreground" dir="rtl">{diff.missing.join(' ، ')}</span></>}
                {diff.missing.length > 0 && diff.extra.length > 0 && ' · '}
                {diff.extra.length > 0 && <>You typed: <span className="font-arabic text-sm text-destructive" dir="rtl">{diff.extra.join(' ، ')}</span></>}
              </p>
            )}
            {round.reveal.note && !answered.right && (
              <p className="pt-1 text-xs leading-relaxed text-muted-foreground" dir="ltr">{round.reveal.note}</p>
            )}
          </div>
        )}
      </div>

      {mode === 'dictation' ? (
        !answered && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (typed.trim()) settle(checkDictation(typed, round.accept), { typed });
            }}
            className="space-y-2.5"
          >
            <input
              ref={input}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              dir="rtl"
              lang="ar"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="What you heard, in Arabic"
              className="w-full rounded-xl border-2 border-border bg-card px-4 py-3 text-center font-arabic text-2xl focus:border-primary focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => settle(false, { typed: '' })}
                className="rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground transition-all active:scale-95"
              >
                Show me
              </button>
              <button
                type="submit"
                disabled={!typed.trim()}
                className="rounded-xl bg-primary py-2.5 font-medium text-primary-foreground transition-all active:scale-95 disabled:opacity-40"
              >
                Check
              </button>
            </div>
          </form>
        )
      ) : (
        <div className={`grid gap-2.5 ${mode === 'pairs' ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {round.options.map((option, i) => {
            const tone = !answered
              ? 'border-border bg-card hover:border-primary/50'
              : option.right
                ? 'border-success bg-success/10'
                : option.label === answered.picked
                  ? 'border-destructive bg-destructive/10'
                  : 'border-border bg-card opacity-50';
            return (
              <button
                key={`${option.label}-${i}`}
                onClick={() => settle(option.right, { picked: option.label })}
                disabled={!!answered}
                className={`relative rounded-xl border-2 px-3 py-3.5 transition-all enabled:active:scale-[0.98] ${tone}`}
              >
                <span className={option.arabic ? 'block font-arabic text-3xl text-foreground' : 'block text-base text-foreground'} dir={option.arabic ? 'rtl' : undefined}>
                  {option.label}
                </span>
                {/* A pair's meanings would give nothing away, but they are kept back anyway: the question is the sound. */}
                {option.sub && answered && <span className="block text-xs text-muted-foreground">{option.sub}</span>}
                {!answered && <span className="absolute end-2 top-1.5 text-[10px] text-muted-foreground/60">{i + 1}</span>}
              </button>
            );
          })}
        </div>
      )}

      {answered && mode === 'pairs' && (
        <div className="grid grid-cols-2 gap-2.5">
          {round.options.map((option) => (
            <button
              key={option.label}
              onClick={() => void playSpeech(option.label, { voice: 'ar' })}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Volume2 className="h-4 w-4" /> Hear <span className="font-arabic text-base" dir="rtl">{option.label}</span>
            </button>
          ))}
        </div>
      )}

      {answered && (
        <button
          onClick={next}
          className="w-full rounded-xl bg-primary py-2.5 font-medium text-primary-foreground transition-all active:scale-95"
        >
          {index + 1 < rounds.length ? 'Next →' : 'Finish'}
        </button>
      )}
    </div>
  );
};

export default EarTraining;
