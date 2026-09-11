import { useState, useMemo, useCallback, useRef, useEffect, forwardRef } from 'react';
import { Check, X, ArrowRight, Hash } from 'lucide-react';
import type { FlashCard } from '@/lib/spaced-repetition';
import { numberToArabicWords, toArabicIndic } from '@/lib/arabic-numbers';
import { countedForm, nounFormFor, isCorrect } from '@/lib/counted-noun';
import { RANGES, drillableNouns, pickNumber, type Range, type DrillNoun } from '@/lib/numbers-drill';
import WordInfoPopover from '@/components/WordInfoPopover';
import BackButton from '@/components/BackButton';
import SpeakButton from '@/components/SpeakButton';
import { useKeyboardOpen, useCoarsePointer } from '@/hooks/useViewport';

interface NumbersDrillProps {
  cards: FlashCard[];
  onBack: () => void;
}

const FORM_LABEL: Record<string, string> = {
  singular: 'singular',
  dual: 'dual',
  plural: 'plural',
};

/** Why the answer is what it is — the rule, not just the word. */
function ruleFor(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo === 1) return 'One takes the singular, and the numeral agrees in gender.';
  if (lastTwo === 2) return 'Two takes the dual, and the numeral agrees in gender.';
  if (lastTwo >= 3 && lastTwo <= 10) {
    return 'Three to ten take the plural — and the numeral flips to the opposite gender.';
  }
  if (lastTwo === 0) return 'Round hundreds and thousands take the singular.';
  return 'Eleven and above go back to the singular.';
}

interface Question {
  n: number;
  noun: DrillNoun;
}

/**
 * Numbers and plurals: one noun, one number, and the two things that have to
 * agree.
 *
 * Two boxes rather than one phrase, so the feedback can say which half went
 * wrong — the numeral's gender and the noun's form are separate skills and a
 * single "incorrect" would hide which one needs work.
 */
const NumbersDrill = ({ cards, onBack }: NumbersDrillProps) => {
  const nouns = useMemo(() => drillableNouns(cards), [cards]);
  const [chosen, setChosen] = useState<string[]>(['unit', 'few', 'teens']);
  const [started, setStarted] = useState(false);
  const [question, setQuestion] = useState<Question | null>(null);
  const [numberInput, setNumberInput] = useState('');
  const [nounInput, setNounInput] = useState('');
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState({ right: 0, asked: 0 });
  const numberRef = useRef<HTMLInputElement>(null);
  const nounRef = useRef<HTMLInputElement>(null);
  // With the keyboard up a phone has room for the word, the number, both
  // boxes and the button only if the card gives most of its height back.
  const tight = useKeyboardOpen();
  const touch = useCoarsePointer();

  const ranges = useMemo(() => RANGES.filter((r) => chosen.includes(r.id)), [chosen]);

  const nextQuestion = useCallback((rs: Range[]) => {
    setQuestion({
      n: pickNumber(rs),
      noun: nouns[Math.floor(Math.random() * nouns.length)],
    });
    setNumberInput('');
    setNounInput('');
    setChecked(false);
    numberRef.current?.focus();
  }, [nouns]);

  // Checking blurs both boxes so the phone keyboard drops off the answer,
  // which also takes Enter out of reach of the inputs' own handler. While an
  // answer is on screen the key is listened for on the window instead, so it
  // still moves on — the desktop equivalent of tapping the left of the screen.
  // Declared before the early returns below, since a hook cannot be
  // conditional on having a question to show.
  useEffect(() => {
    if (!checked) return;
    const onEnter = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      nextQuestion(ranges);
    };
    window.addEventListener('keydown', onEnter);
    return () => window.removeEventListener('keydown', onEnter);
  }, [checked, nextQuestion, ranges]);

  if (nouns.length === 0) {
    return (
      <div className="space-y-4">
        <BackButton onClick={onBack} />
        <div className="rounded-xl border border-border/60 bg-card p-6 text-center">
          <Hash className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
          <p className="font-medium text-foreground">No nouns ready to drill yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A noun needs a plural and a gender before it can be counted. New words you
            add are tagged with both automatically.
          </p>
        </div>
      </div>
    );
  }

  if (!started) {
    const toggle = (id: string) =>
      setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

    return (
      <div className="space-y-4">
        <BackButton onClick={onBack} />
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Numbers and plurals</h1>
          <p className="text-sm text-muted-foreground">
            Pick the ranges to practise. {nouns.length} nouns ready.
          </p>
        </div>

        <div className="space-y-2">
          {RANGES.map((range) => {
            const on = chosen.includes(range.id);
            return (
              <button
                key={range.id}
                onClick={() => toggle(range.id)}
                aria-pressed={on}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-start transition-colors ${
                  on ? 'border-primary bg-primary/5' : 'border-border/60 bg-card hover:bg-muted/40'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                    on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'
                  }`}
                >
                  {on && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-foreground">{range.label}</span>
                  <span className="block text-xs text-muted-foreground">{range.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        <button
          disabled={ranges.length === 0}
          onClick={() => {
            setStarted(true);
            setScore({ right: 0, asked: 0 });
            nextQuestion(ranges);
          }}
          className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {ranges.length === 0 ? 'Pick at least one range' : 'Start'}
        </button>
      </div>
    );
  }

  if (!question) return null;

  const { n, noun } = question;
  const expectedNumber = numberToArabicWords(n, noun.gender);
  const expectedNoun = countedForm(n, noun);
  const numberRight = isCorrect(numberInput, expectedNumber);
  const nounRight = isCorrect(nounInput, expectedNoun);

  const check = () => {
    if (checked) return;
    setChecked(true);
    setScore((s) => ({ right: s.right + (numberRight && nounRight ? 1 : 0), asked: s.asked + 1 }));
    // Let the keyboard go, so the answer and the rule are not typed over.
    numberRef.current?.blur();
    nounRef.current?.blur();
  };

  const advance = () => nextQuestion(ranges);

  /**
   * Enter moves on: to the other box while one is empty, to the answer once
   * both are filled, and to the next question once it has been answered. It
   * is the only key on the phone keyboard that can do any of this without
   * reaching for the screen.
   */
  const onKeyDown = (e: React.KeyboardEvent, from: 'number' | 'noun') => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (checked) {
      advance();
      return;
    }
    const hasNumber = numberInput.trim() !== '';
    const hasNoun = nounInput.trim() !== '';
    if (hasNumber && hasNoun) {
      check();
    } else if (from === 'number' && !hasNoun) {
      nounRef.current?.focus();
    } else if (from === 'noun' && !hasNumber) {
      numberRef.current?.focus();
    }
  };

  return (
    <div
      className={tight ? 'space-y-2' : 'space-y-4'}
      // Once an answer is on screen a tap on the left half moves on, so the
      // next question is one thumb-reach away rather than a stretch to a
      // button at the bottom. Handled here rather than as an overlay so it
      // cannot swallow a tap meant for the button, an input, or the word's
      // popover — those are excluded by target, not by stacking order.
      onClick={(e) => {
        if (!checked || !touch) return;
        const el = e.target as HTMLElement;
        if (el.closest('button,input,a,[role="dialog"],[aria-haspopup]')) return;
        if (e.clientX < window.innerWidth / 2) advance();
      }}
    >
      <div className="flex items-center justify-between">
        <BackButton onClick={() => setStarted(false)} />
        <span className="text-sm text-muted-foreground">
          {score.right}/{score.asked}
        </span>
      </div>

      <div className={`rounded-xl border border-border/60 bg-card text-center ${tight ? 'p-3' : 'p-6'}`}>
        {!tight && (
          <p className="text-xs uppercase tracking-wider text-muted-foreground/70">
            {noun.english}
          </p>
        )}
        <div className="mt-1 flex items-center justify-center gap-2">
          {/* Hovering the word gives the whole card — definition, root, forms,
              family — so a blank can be thought through rather than guessed. */}
          <WordInfoPopover card={noun.card}>
            <span
              className={`font-arabic font-bold text-foreground ${tight ? 'text-xl' : 'text-3xl'}`}
              dir="rtl"
            >
              {noun.singular}
            </span>
          </WordInfoPopover>
          <SpeakButton word={noun.singular} size={16} />
        </div>
        {/* The gender stays even when tight: it is what the answer turns on. */}
        <p className="mt-0.5 text-xs font-medium text-primary">
          {noun.gender === 'f' ? 'feminine' : 'masculine'}
        </p>
        <p
          className={`font-arabic font-bold text-foreground ${tight ? 'mt-1 text-3xl' : 'mt-4 text-5xl'}`}
          dir="rtl"
        >
          {toArabicIndic(n)}
        </p>
      </div>

      <div className={tight ? 'space-y-2' : 'space-y-3'}>
        <Field
          ref={numberRef}
          label="The number, in words"
          value={numberInput}
          onChange={setNumberInput}
          onKeyDown={(e) => onKeyDown(e, 'number')}
          enterKeyHint="next"
          checked={checked}
          correct={numberRight}
          answer={expectedNumber}
          tight={tight}
        />
        <Field
          ref={nounRef}
          label={`The noun${checked ? ` (${FORM_LABEL[nounFormFor(n)]})` : ''}`}
          value={nounInput}
          onChange={setNounInput}
          onKeyDown={(e) => onKeyDown(e, 'noun')}
          enterKeyHint="done"
          checked={checked}
          correct={nounRight}
          answer={expectedNoun}
          tight={tight}
        />
      </div>

      {checked && (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
          {!tight && <p className="text-sm text-foreground">{ruleFor(n)}</p>}
          <p className="mt-2 font-arabic text-xl text-foreground" dir="rtl">
            {expectedNumber} {expectedNoun}
          </p>
        </div>
      )}

      {checked ? (
        <button
          onClick={() => nextQuestion(ranges)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Next <ArrowRight className="h-4 w-4" />
          {touch && <span className="text-xs font-normal opacity-70">or tap the left</span>}
        </button>
      ) : (
        <button
          onClick={check}
          className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Check
        </button>
      )}
    </div>
  );
};

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  enterKeyHint: 'next' | 'done';
  checked: boolean;
  correct: boolean;
  answer: string;
  tight: boolean;
}

/**
 * One answer box.
 *
 * `enterKeyHint` is what makes the phone keyboard show "next" on the first box
 * and "done" on the second, so the key that moves you on says what it does
 * before you press it.
 */
const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, value, onChange, onKeyDown, enterKeyHint, checked, correct, answer, tight },
  ref,
) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        <input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          enterKeyHint={enterKeyHint}
          readOnly={checked}
          dir="rtl"
          aria-label={label}
          className={`w-full rounded-xl border bg-card px-3 font-arabic text-foreground outline-none transition-colors ${
            tight ? 'py-2 text-lg' : 'py-3 text-xl'
          } ${
            checked
              ? correct
                ? 'border-success'
                : 'border-destructive'
              : 'border-border/60 focus:border-primary'
          }`}
        />
        {checked && (
          <span className="absolute inset-y-0 left-3 flex items-center">
            {correct ? (
              <Check className="h-5 w-5 text-success" />
            ) : (
              <X className="h-5 w-5 text-destructive" />
            )}
          </span>
        )}
      </div>
      {checked && !correct && (
        <p className="mt-1 font-arabic text-lg text-success" dir="rtl">
          {answer}
        </p>
      )}
    </div>
  );
});

export default NumbersDrill;
