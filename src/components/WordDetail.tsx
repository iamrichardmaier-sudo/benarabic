import { useEffect, useState } from 'react';
import type { FlashCard } from '@/lib/spaced-repetition';
import { relatedInDeck, visibleCompanions, MAX_RELATED, wordKey } from '@/lib/word-relations';
import { fetchWordsByRoot } from '@/lib/bible-root-index';
import { dialectView, showsShaamiRows } from '@/lib/dialect';
import { usePreferences } from '@/hooks/usePreferences';
import type { BibleWordTag } from '@/hooks/useBibleWordTags';

interface WordDetailProps {
  card: FlashCard;
  /** The rest of the deck, for the "same root" and "same form" lists. */
  deck?: FlashCard[];
  /**
   * Look up other words on this root in the tagged Bible corpus. Off by
   * default because it costs a request: worth it on a flashcard the learner is
   * sitting with, not on a hover panel they are skimming past.
   */
  includeCorpus?: boolean;
  className?: string;
}

const TYPE_LABELS: Record<string, string> = {
  verb: 'Verb',
  noun: 'Noun',
  adjective: 'Adjective',
  participle: 'Participle',
  masdar: 'Verbal noun',
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-0.5">
      <span className="text-xs leading-snug text-muted-foreground">{label}</span>
      <span className="font-arabic text-lg leading-snug text-foreground" dir="rtl">
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border/60 pt-2.5">
      <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
        {title}
      </h4>
      {children}
    </div>
  );
}

/**
 * Everything the app knows about one word, in the order the phone widget shows
 * it: what the word is, then its own other forms, then the words standing
 * around it. Shared by the flashcard answer side, the memorize screen and the
 * deck list, so a word reads the same wherever it is met.
 *
 * Sections with nothing to say are left out rather than rendered empty, so a
 * bare card still looks like a bare card.
 */
const WordDetail = ({ card, deck = [], includeCorpus = false, className = '' }: WordDetailProps) => {
  const { dialect } = usePreferences();
  const [corpus, setCorpus] = useState<BibleWordTag[] | null>(null);

  useEffect(() => {
    if (!includeCorpus || !card.root) {
      setCorpus(null);
      return;
    }
    let cancelled = false;
    fetchWordsByRoot(card.root, card.word)
      .then((words) => {
        if (!cancelled) setCorpus(words);
      })
      .catch(() => {
        // A missing cross-reference list is not worth an error message.
        if (!cancelled) setCorpus([]);
      });
    return () => {
      cancelled = true;
    };
  }, [includeCorpus, card.root, card.word]);

  const { sameRoot, sameForm } = relatedInDeck(card, deck);

  const view = dialectView(card, dialect);
  const withDialect = showsShaamiRows(dialect);

  const forms: { label: string; value: string }[] = [
    // Whatever the headline displaced — the Fusha, when Shaami is leading.
    ...view.extraForms,
    { label: 'Plural', value: card.fushaPlural ?? '' },
    // Suppressed when it is already the headline, so it is never printed twice.
    { label: 'Shaami', value: withDialect && !view.isDialectForm ? card.shaami ?? '' : '' },
    { label: 'Shaami pl.', value: withDialect ? card.shaamiPlural ?? '' : '' },
    { label: 'Past', value: card.pastTense ?? '' },
    { label: 'Present', value: card.presentTense ?? '' },
    { label: 'Masdar', value: card.masdarForm ?? '' },
  ].filter((f) => f.value);

  // A companion form that repeats a row already above it — the masdar, the
  // plural, the Shaami — is noise, not a second word.
  const companions = visibleCompanions(
    card.companionForms ?? [],
    view.headline,
    forms.map((f) => f.value),
  );

  // Anything already named above should not reappear in the Bible list.
  const claimed = new Set<string>([
    wordKey(card.word),
    wordKey(card.wordVoweled),
    ...companions.map((c) => wordKey(c.form)),
    ...sameRoot.map((w) => wordKey(w.ar)),
    ...sameForm.map((w) => wordKey(w.ar)),
  ]);
  const corpusWords = (corpus ?? [])
    .filter((w) => !claimed.has(wordKey(w.lemma ?? w.surface)))
    .slice(0, MAX_RELATED - 1);

  const meta = [
    card.root,
    card.verbForm ? `Form ${card.verbForm}` : null,
    card.wordType ? TYPE_LABELS[card.wordType] ?? null : null,
  ].filter(Boolean) as string[];

  const hasBody =
    forms.length > 0 ||
    companions.length > 0 ||
    sameRoot.length > 0 ||
    sameForm.length > 0 ||
    corpusWords.length > 0;

  if (meta.length === 0 && !hasBody) return null;

  return (
    <div className={`space-y-2.5 text-start ${className}`}>
      {meta.length > 0 && (
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[13px] font-semibold text-primary">
          {meta.map((bit, i) => (
            <span key={bit} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted-foreground/50">·</span>}
              <span className={i === 0 && card.root ? 'font-arabic text-[15px]' : ''} dir={i === 0 && card.root ? 'rtl' : undefined}>
                {bit}
              </span>
            </span>
          ))}
        </p>
      )}

      {forms.length > 0 && (
        <Section title="Its other forms">
          {forms.map((f) => (
            <Row key={f.label} label={f.label} value={f.value} />
          ))}
        </Section>
      )}

      {companions.length > 0 && (
        <Section title="Word family">
          {companions.map((c, i) => (
            <Row key={`${c.form}-${i}`} label={c.label} value={c.form} />
          ))}
        </Section>
      )}

      {sameRoot.length > 0 && (
        <Section title="Same root in your deck">
          {sameRoot.map((w) => (
            <Row key={w.ar} label={w.en} value={w.ar} />
          ))}
        </Section>
      )}

      {corpusWords.length > 0 && (
        <Section title="Same root in the Bible">
          {corpusWords.map((w) => (
            <Row key={w.surface} label={w.gloss ?? ''} value={w.lemma ?? w.surface} />
          ))}
        </Section>
      )}

      {sameForm.length > 0 && card.verbForm && (
        <Section title={`Other Form ${card.verbForm} words you know`}>
          {sameForm.map((w) => (
            <Row key={w.ar} label={w.en} value={w.ar} />
          ))}
        </Section>
      )}
    </div>
  );
};

export default WordDetail;
