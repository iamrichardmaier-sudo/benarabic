import { useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import BackButton from '@/components/BackButton';
import SpeakButton, { speakArabic } from '@/components/SpeakButton';
import WordDetail from '@/components/WordDetail';
import { allCloze, clozeOptions, clozeSession, skeleton, type ClozeItem } from '@/lib/cloze';
import { logReview } from '@/lib/review-log';
import { XP_LEARN } from '@/lib/levels';
import type { FlashCard } from '@/lib/spaced-repetition';

interface ClozePracticeProps {
  cards: FlashCard[];
  userId?: string;
  onBack: () => void;
  /** Credit XP for an answer. */
  onEarn?: (amount: number) => void;
}

const SESSION = 10;
/** Fewer sentences than this and the wrong answers would repeat every question. */
const MIN_ITEMS = 4;

const missedKey = (userId?: string) => `wazn-cloze-missed:${userId ?? 'anon'}`;

function readMissed(userId?: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(missedKey(userId)) || '[]') as string[]);
  } catch {
    return new Set();
  }
}

function writeMissed(userId: string | undefined, missed: Set<string>): void {
  try {
    localStorage.setItem(missedKey(userId), JSON.stringify([...missed].slice(-200)));
  } catch {
    /* it just will not be remembered */
  }
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Fill in the blank: a real sentence with one word taken out, and four words
 * to choose from.
 *
 * The sentences are the ones the cards already carry. The word taken out is
 * the card's own where the sentence uses it, and otherwise a relative on the
 * same root, which the screen says, since "which word on this root fits here"
 * is a different and equally useful question. Nothing is rescheduled: this is
 * practice, and what it records goes to the history, where a word missed here
 * counts toward the words that keep being missed.
 */
const ClozePractice = ({ cards, userId, onBack, onEarn }: ClozePracticeProps) => {
  const items = useMemo(() => allCloze(cards), [cards]);
  const [run, setRun] = useState(0);
  // Built once per run: the deck changing under a session (a sync landing)
  // must not reshuffle the question on screen.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const session = useMemo(() => clozeSession(items, SESSION, readMissed(userId)), [run, items.length === 0]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [right, setRight] = useState(0);

  const item: ClozeItem | undefined = session[index];
  const options = useMemo(
    () => (item ? shuffle([item.answer, ...clozeOptions(item, items)]) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item?.card.id, run],
  );
  const sentence = item ? item.tokens.join(' ') : '';
  const correct = item && picked ? skeleton(picked) === skeleton(item.answer) : false;

  // Once answered, the whole sentence is read out: hearing it complete is
  // half of what the exercise is for.
  useEffect(() => {
    if (picked && sentence) speakArabic(sentence);
  }, [picked, sentence]);

  const choose = (option: string) => {
    if (!item || picked) return;
    const ok = skeleton(option) === skeleton(item.answer);
    setPicked(option);
    if (ok) setRight((n) => n + 1);
    onEarn?.(ok ? XP_LEARN.choiceRight : XP_LEARN.choiceWrong);
    logReview(userId, { cardId: item.card.id, kind: 'cloze', rating: ok ? 'good' : 'again' });
    const missed = readMissed(userId);
    if (ok) missed.delete(item.card.id);
    else missed.add(item.card.id);
    writeMissed(userId, missed);
  };

  const next = () => {
    setPicked(null);
    setIndex((i) => i + 1);
  };

  const restart = () => {
    setRun((n) => n + 1);
    setIndex(0);
    setPicked(null);
    setRight(0);
  };

  // 1-4 pick an option, Enter moves on.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!item) return;
      if (picked && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        next();
      } else if (!picked && /^[1-4]$/.test(e.key) && options[Number(e.key) - 1]) {
        choose(options[Number(e.key) - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.card.id, picked, options]);

  if (items.length < MIN_ITEMS) {
    return (
      <div className="space-y-4">
        <BackButton onClick={onBack} label="Learn" />
        <h1 className="text-xl font-bold text-foreground">Fill in the blank</h1>
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          This is made from the example sentences on your cards, and too few of your cards have one
          yet. Cards from the chapter decks come with them.
        </p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="space-y-4">
        <BackButton onClick={onBack} label="Learn" />
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
          <p className="text-4xl font-bold tabular-nums text-foreground">
            {right}<span className="text-muted-foreground">/{session.length}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {right === session.length
              ? 'Every one. The words you missed before have been cleared.'
              : 'The ones you missed will open your next round.'}
          </p>
          <button
            onClick={restart}
            className="w-full rounded-xl bg-primary py-2.5 font-medium text-primary-foreground transition-all active:scale-95"
          >
            Another round
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} label="Learn" />

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{index + 1} / {session.length}</span>
        <span>{right} correct</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div
          className="h-1.5 rounded-full bg-primary transition-all duration-300"
          style={{ width: `${(index / session.length) * 100}%` }}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <p className="text-center text-xs uppercase tracking-wide text-muted-foreground">
          {item.exact ? 'Which word is missing?' : `Which word on the root ${item.card.root ?? ''} is missing?`}
        </p>

        <p className="text-center font-arabic text-2xl leading-loose text-foreground" dir="rtl">
          {item.tokens.map((token, i) => (
            <span key={i}>
              {i === item.blank ? (
                picked ? (
                  <span className={`font-bold ${correct ? 'text-success' : 'text-primary'}`}>{token}</span>
                ) : (
                  <span
                    aria-label="blank"
                    className="mx-1 inline-block w-24 border-b-2 border-primary align-baseline"
                  >
                    &nbsp;
                  </span>
                )
              ) : (
                token
              )}{' '}
            </span>
          ))}
        </p>

        {item.english && <p className="text-center text-sm text-muted-foreground">{item.english}</p>}
        {picked && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <SpeakButton word={sentence} size={16} />
            {item.reference && <span>{item.reference}</span>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {options.map((option, i) => {
          const isAnswer = skeleton(option) === skeleton(item.answer);
          const tone = !picked
            ? 'border-border bg-card hover:border-primary/50'
            : isAnswer
              ? 'border-success bg-success/10 text-success'
              : option === picked
                ? 'border-destructive bg-destructive/10 text-destructive'
                : 'border-border bg-card opacity-50';
          return (
            <button
              key={option}
              onClick={() => choose(option)}
              disabled={!!picked}
              dir="rtl"
              className={`relative rounded-xl border-2 px-3 py-3.5 font-arabic text-xl transition-all enabled:active:scale-[0.98] ${tone}`}
            >
              {option}
              {picked && isAnswer && <Check className="absolute start-2 top-2 h-4 w-4" />}
              {picked && !isAnswer && option === picked && <X className="absolute start-2 top-2 h-4 w-4" />}
              {!picked && (
                <span className="absolute end-2 top-1.5 font-sans text-[10px] text-muted-foreground/60">{i + 1}</span>
              )}
            </button>
          );
        })}
      </div>

      {picked && (
        <>
          <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-2">
            <p className="text-center text-sm text-muted-foreground">
              {item.exact ? 'From your card' : 'A relative of your card'}{' '}
              <span className="font-arabic text-base text-foreground" dir="rtl">{item.card.wordVoweled || item.card.word}</span>
              {item.card.english ? ` — ${item.card.english}` : ''}
            </p>
            {/* The example is the sentence just answered; the panel would print it a second time. */}
            <WordDetail card={{ ...item.card, quranExample: null }} deck={cards} />
          </div>
          <button
            onClick={next}
            className="w-full rounded-xl bg-primary py-2.5 font-medium text-primary-foreground transition-all active:scale-95"
          >
            {index + 1 < session.length ? 'Next →' : 'Finish'}
          </button>
        </>
      )}
    </div>
  );
};

export default ClozePractice;
