import { useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import BackButton from '@/components/BackButton';
import WordRow from '@/components/WordRow';
import type { FlashCard, VerbForm } from '@/lib/spaced-repetition';
import { VERB_FORM_GLOSSES } from '@/lib/morphology';
import { FORMS, formCounts, formGroups } from '@/lib/form-browse';
import { searchDeck } from '@/lib/deck-search';

interface FormExplorerProps {
  cards: FlashCard[];
  onBack: () => void;
}

/** One form: what it does, then every word in the deck built on it. */
const FormDetail = ({ form, cards, onBack }: { form: VerbForm; cards: FlashCard[]; onBack: () => void }) => {
  const [query, setQuery] = useState('');
  const gloss = VERB_FORM_GLOSSES[form];
  const groups = useMemo(() => {
    const shown = new Set(searchDeck(cards, query).map((c) => c.id));
    return formGroups(cards, form)
      .map((g) => ({ ...g, cards: g.cards.filter((c) => shown.has(c.id)) }))
      .filter((g) => g.cards.length > 0);
  }, [cards, form, query]);
  const total = useMemo(() => formGroups(cards, form).reduce((n, g) => n + g.cards.length, 0), [cards, form]);

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} label="Forms" />

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold text-foreground">Form {form}</h1>
          {gloss && <span className="font-arabic text-3xl font-bold text-primary" dir="rtl">{gloss.pattern}</span>}
        </div>
        {gloss && (
          <>
            <p className="mt-1 text-sm font-semibold text-foreground">{gloss.summary}</p>
            <p className="mt-1 text-sm text-muted-foreground">{gloss.detail}</p>
          </>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          {total} word{total === 1 ? '' : 's'} in your deck
        </p>
      </div>

      {total > 6 && (
        <label className="relative block">
          <span className="sr-only">Search these words</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search Form ${form} words`}
            className="w-full rounded-xl border border-border bg-background py-2.5 ps-9 pe-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
      )}

      {groups.map((g) => (
        <section key={g.title} className="space-y-2" aria-label={g.title}>
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {g.title} <span className="font-normal">· {g.cards.length}</span>
          </h2>
          <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card">
            {g.cards.map((c) => (
              <WordRow key={c.id} card={c} deck={cards} note={c.root ?? undefined} />
            ))}
          </div>
        </section>
      ))}

      {total === 0 && (
        <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          None of your words is tagged Form {form} yet.
        </p>
      )}
      {total > 0 && groups.length === 0 && (
        <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          No Form {form} word matches “{query}”.
        </p>
      )}
    </div>
  );
};

/**
 * Browse the deck by verb form: the ten forms with how many of the
 * learner's words each holds, and each one opening onto those words —
 * verbs, verbal nouns and participles together, since they share the form.
 */
const FormExplorer = ({ cards, onBack }: FormExplorerProps) => {
  const [selected, setSelected] = useState<VerbForm | null>(null);
  const counts = useMemo(() => formCounts(cards), [cards]);
  const untagged = useMemo(
    () => cards.filter((c) => !c.verbForm && (c.wordType === 'verb' || c.wordType === 'masdar' || c.wordType === 'participle')).length,
    [cards],
  );
  const tagged = FORMS.reduce((n, f) => n + counts[f], 0);

  if (selected) return <FormDetail form={selected} cards={cards} onBack={() => setSelected(null)} />;

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} label="Learn" />

      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Forms</h1>
        <p className="text-sm text-muted-foreground">
          {tagged === 0
            ? 'Words tagged with a verb form will gather here.'
            : `${tagged} word${tagged === 1 ? '' : 's'} across the ten forms. Tap one to see every word in your deck built on it.`}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {FORMS.map((form, i) => {
          const gloss = VERB_FORM_GLOSSES[form];
          const n = counts[form];
          return (
            <button
              key={form}
              onClick={() => setSelected(form)}
              aria-label={`Form ${form}, ${n} word${n === 1 ? '' : 's'}`}
              className={`flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/40 ${
                i > 0 ? 'border-t border-border' : ''
              } ${n === 0 ? 'opacity-60' : ''}`}
            >
              <span className="w-10 shrink-0 text-sm font-bold text-primary">{form}</span>
              <span className="font-arabic w-20 shrink-0 text-xl font-bold text-foreground" dir="rtl">
                {gloss?.pattern}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{gloss?.summary}</span>
                <span className="block text-xs text-muted-foreground">
                  {n} word{n === 1 ? '' : 's'}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
      </div>

      {untagged > 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          {untagged} verb{untagged === 1 ? '' : 's'} and related word{untagged === 1 ? ' has' : 's have'} no form recorded yet, so
          {untagged === 1 ? ' it is' : ' they are'} not listed here.
        </p>
      )}
    </div>
  );
};

export default FormExplorer;
