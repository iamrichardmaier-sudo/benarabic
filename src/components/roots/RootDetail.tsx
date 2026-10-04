import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import BackButton from '@/components/BackButton';
import SpeakButton from '@/components/SpeakButton';
import WordDetail from '@/components/WordDetail';
import { useDeckActions } from '@/contexts/DeckActionsContext';
import type { FlashCard, VerbForm } from '@/lib/spaced-repetition';
import { VERB_FORM_GLOSSES } from '@/lib/morphology';
import { entriesForRoots, entryToCardFields, type DictionaryEntry } from '@/lib/dictionary';
import {
  buildRootTree, fillPattern, rootVariants, scriptureNotInDeck, toScriptureWord,
  verbFormRows, type FormRow, type TreeWord,
} from '@/lib/root-tree';

interface RootDetailProps {
  root: string;
  cards: FlashCard[];
  meaning: string | null;
  onBack: () => void;
}

const STATUS_STYLE: Record<FormRow['status'], string> = {
  deck: 'border-primary bg-primary text-primary-foreground',
  scripture: 'border-primary/60 bg-background text-primary',
  none: 'border-border bg-muted/40 text-muted-foreground/70',
};

/** One word in the tree: tap to open everything the app knows about it. */
const WordNode = ({ word, deck }: { word: TreeWord; deck: FlashCard[] }) => {
  const [open, setOpen] = useState(false);
  return (
    <li className="relative before:absolute before:-start-4 before:top-4 before:h-px before:w-3 before:bg-border">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-start hover:bg-muted/50"
        >
          <span className="truncate text-xs text-muted-foreground">{word.en || '—'}</span>
          <span className="font-arabic shrink-0 text-lg text-foreground" dir="rtl">
            {word.ar}
          </span>
        </button>
        <SpeakButton word={word.ar.split('/')[0].trim()} size={16} />
      </div>
      {open && (
        <div className="mb-2 ms-2 rounded-xl border border-border/60 bg-card p-3">
          <WordDetail card={word.card} deck={deck} />
        </div>
      )}
    </li>
  );
};

const Branch = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <li className="space-y-1">
    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">{title}</p>
    <ul className="ms-2 space-y-0.5 border-s border-border ps-4">{children}</ul>
  </li>
);

/**
 * Everything built on one root: the ten verb forms at a glance, then the
 * learner's own words as a tree, then what the scripture corpus adds that the
 * deck does not hold yet.
 */
const RootDetail = ({ root, cards, meaning, onBack }: RootDetailProps) => {
  const { addWord } = useDeckActions();
  const [scripture, setScripture] = useState<DictionaryEntry[] | null>(null);
  const [formOpen, setFormOpen] = useState<VerbForm | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const tree = useMemo(() => buildRootTree(cards, root), [cards, root]);

  useEffect(() => {
    let cancelled = false;
    setScripture(null);
    entriesForRoots(rootVariants(root)).then((entries) => {
      if (!cancelled) setScripture(entries);
    });
    return () => {
      cancelled = true;
    };
  }, [root]);

  const scriptureWords = useMemo(() => (scripture ?? []).map(toScriptureWord), [scripture]);
  const rows = useMemo(() => verbFormRows(tree, scriptureWords), [tree, scriptureWords]);
  const more = useMemo(() => scriptureNotInDeck(tree, scriptureWords), [tree, scriptureWords]);
  const entryByLemma = useMemo(
    () => new Map((scripture ?? []).map((e) => [e.lemma, e])),
    [scripture],
  );

  const open = rows.find((r) => r.form === formOpen) ?? null;
  const openGloss = formOpen ? VERB_FORM_GLOSSES[formOpen] : null;
  const poured = openGloss ? fillPattern(openGloss.pattern, root) : null;

  const add = async (lemma: string) => {
    const entry = entryByLemma.get(lemma);
    if (!entry || !addWord) return;
    const fields = entryToCardFields(entry);
    await addWord({
      word: fields.word,
      english: fields.english,
      root: fields.root,
      wordType: fields.wordType,
      verbForm: fields.verbForm,
    });
    setAdded((prev) => new Set(prev).add(lemma));
  };

  return (
    <div className="space-y-5">
      <BackButton onClick={onBack} label="Roots" />

      <div className="space-y-1 text-center">
        <p className="font-arabic text-5xl font-bold text-foreground" dir="rtl">
          {root}
        </p>
        {meaning && <p className="text-sm text-muted-foreground">{meaning}</p>}
        <p className="text-xs text-muted-foreground">
          {tree.total} word{tree.total === 1 ? '' : 's'} in your deck
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Verb forms
        </h2>
        <div className="grid grid-cols-5 gap-1.5">
          {rows.map((r) => (
            <button
              key={r.form}
              onClick={() => setFormOpen(formOpen === r.form ? null : r.form)}
              aria-pressed={formOpen === r.form}
              aria-label={`Form ${r.form}, ${
                r.status === 'deck' ? 'in your deck' : r.status === 'scripture' ? 'seen in scripture' : 'not seen'
              }`}
              className={`rounded-xl border py-2 text-sm font-bold transition-all active:scale-95 ${STATUS_STYLE[r.status]} ${
                formOpen === r.form ? 'ring-2 ring-primary/40' : ''
              }`}
            >
              {r.form}
            </button>
          ))}
        </div>
        <p className="px-1 text-[11px] text-muted-foreground">
          Filled: you hold a verb in this form. Outlined: it appears in scripture. Grey: neither.
          Not every root takes every form.
        </p>

        {open && openGloss && (
          <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">
                Form {open.form} · {openGloss.summary}
              </p>
              <span className="font-arabic text-lg text-foreground" dir="rtl">
                {poured ?? openGloss.pattern}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{openGloss.detail}</p>
            {poured && open.status === 'none' && (
              <p className="text-xs text-muted-foreground">
                The pattern on this root would be <span className="font-arabic text-sm text-foreground">{poured}</span> —
                a guide to the shape, not a claim that the word is used.
              </p>
            )}
            {open.inDeck.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">In your deck</p>
                {open.inDeck.map((w) => (
                  <p key={w.card.id} className="flex items-baseline justify-between gap-3 py-0.5">
                    <span className="text-xs text-muted-foreground">{w.en}</span>
                    <span className="font-arabic text-lg" dir="rtl">{w.ar}</span>
                  </p>
                ))}
              </div>
            )}
            {open.inScripture.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">In scripture</p>
                {open.inScripture.map((w) => (
                  <p key={w.lemma} className="flex items-baseline justify-between gap-3 py-0.5">
                    <span className="text-xs text-muted-foreground">{w.gloss ?? ''}</span>
                    <span className="font-arabic text-lg" dir="rtl">{w.lemma}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Your words on this root
        </h2>
        {tree.total === 0 ? (
          <p className="rounded-xl border border-border bg-card px-4 py-5 text-center text-sm text-muted-foreground">
            You do not hold a word on this root yet.
          </p>
        ) : (
          <ul className="space-y-3 rounded-2xl border border-border bg-card p-4">
            {tree.verbs.length > 0 && (
              <Branch title="Verbs">
                {tree.verbs.map((v) => (
                  <li key={v.form ?? 'none'} className="space-y-0.5">
                    <p className="text-xs font-semibold text-primary">
                      {v.form ? `Form ${v.form}` : 'Form not recorded'}
                      {v.form && VERB_FORM_GLOSSES[v.form] && (
                        <span className="font-normal text-muted-foreground">
                          {' '}· {VERB_FORM_GLOSSES[v.form].summary}
                        </span>
                      )}
                    </p>
                    <ul className="border-s border-border ps-4">
                      {v.words.map((w) => (
                        <WordNode key={w.card.id} word={w} deck={cards} />
                      ))}
                    </ul>
                  </li>
                ))}
              </Branch>
            )}
            {tree.groups.map((g) => (
              <Branch key={g.type} title={g.label}>
                {g.words.map((w) => (
                  <WordNode key={w.card.id} word={w} deck={cards} />
                ))}
              </Branch>
            ))}
          </ul>
        )}
      </section>

      {more.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Also on this root in scripture
          </h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {more.slice(0, 12).map((w, i) => (
              <div
                key={w.lemma}
                className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? 'border-t border-border' : ''}`}
              >
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{w.gloss ?? ''}</span>
                <span className="font-arabic text-lg text-foreground" dir="rtl">{w.lemma}</span>
                {addWord && (
                  <button
                    onClick={() => add(w.lemma)}
                    disabled={added.has(w.lemma)}
                    aria-label={`Add ${w.lemma} to your deck`}
                    className="rounded-full border border-primary p-1.5 text-primary transition-all active:scale-90 disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default RootDetail;
