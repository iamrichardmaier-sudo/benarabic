import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import SpeakButton from '@/components/SpeakButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { normalizeArabic } from '@/lib/arabic-normalize';
import {
  loadEntry, meanings, rememberSearch, type DictEntry, type DictHit, type Family,
} from '@/lib/ref-dictionary';
import { AddButton } from './dict-ui';
import { posLine, toNewWord } from '@/lib/ref-dictionary-cards';
import FamilyView from './FamilyView';

interface Props {
  hit: DictHit;
  byId: Map<number, DictHit>;
  deckKeys: Set<string>;
  onAdd?: (word: ReturnType<typeof toNewWord>) => Promise<void>;
  onOpen: (hit: DictHit) => void;
  onOpenRoot: (root: string) => void;
  autoAdd?: boolean;
  onAutoAdded?: () => void;
}

const PRONOUNS: [string, string, string][] = [
  ['1s', 'أَنَا', 'I'], ['2ms', 'أَنْتَ', 'you (m.)'], ['2fs', 'أَنْتِ', 'you (f.)'],
  ['3ms', 'هُوَ', 'he'], ['3fs', 'هِيَ', 'she'], ['2d', 'أَنْتُمَا', 'you two'],
  ['3md', 'هُمَا', 'they two (m.)'], ['3fd', 'هُمَا', 'they two (f.)'], ['1p', 'نَحْنُ', 'we'],
  ['2mp', 'أَنْتُمْ', 'you all (m.)'], ['2fp', 'أَنْتُنَّ', 'you all (f.)'],
  ['3mp', 'هُمْ', 'they (m.)'], ['3fp', 'هُنَّ', 'they (f.)'],
];
const MOODS: [string, string][] = [
  ['past', 'Past'], ['present', 'Present'], ['subjunctive', 'Subjunctive'],
  ['jussive', 'Jussive'], ['imperative', 'Imperative'],
];

/** The forms worth seeing at a glance, in the order a learner asks for them. */
function highlights(e: DictEntry): { label: string; words: string[]; note?: string }[] {
  const list: { label: string; words?: string[]; note?: string }[] = [
    { label: 'Plural', words: e.pl },
    { label: 'Singular', words: e.sing },
    { label: 'Feminine', words: e.fem },
    { label: 'Masculine plural', words: e.mpl },
    { label: 'Feminine plural', words: e.fpl },
    { label: 'Collective', words: e.coll },
    { label: 'Elative', words: e.elative, note: 'more / most' },
    { label: 'Present', words: e.present },
    { label: 'Verbal noun', words: e.masdar },
    { label: 'Active participle', words: e.ap },
    { label: 'Passive participle', words: e.pp },
    { label: 'Verbal noun of', words: e.masdarOf },
  ];
  return list.filter((x): x is { label: string; words: string[]; note?: string } => !!x.words?.length);
}

/**
 * One dictionary entry, set out the way the rest of Wazn sets out a word: the
 * Arabic large and in the learner's card script, the meaning under it, the
 * forms a learner asks for first, then the full meanings, the root family and
 * the conjugation.
 */
const DictionaryEntryView = ({ hit, byId, deckKeys, onAdd, onOpen, onOpenRoot, autoAdd, onAutoAdded }: Props) => {
  const [data, setData] = useState<{ entry: DictEntry; family: Family | null; members: Map<number, DictEntry> } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    rememberSearch(hit.id);
    loadEntry(hit)
      .then((d) => live && setData(d))
      .catch((err) => live && setError(err instanceof Error ? err.message : String(err)));
    window.scrollTo({ top: 0 });
    return () => { live = false; };
  }, [hit]);

  const owned = deckKeys.has(normalizeArabic(hit.word));
  const e = data?.entry;

  // Sent here by a public page's "Add to my flashcards": add it once, and
  // only once the deck has loaded, so the duplicate guard has something to
  // check against.
  useEffect(() => {
    if (!autoAdd || !e) return;
    onAutoAdded?.();
    if (!owned && onAdd) void onAdd(toNewWord(e, hit.gloss));
  }, [autoAdd, e, owned, onAdd, onAutoAdded, hit.gloss]);
  const senses = useMemo(() => (e ? meanings(e) : []), [e]);
  const hl = useMemo(() => (e ? highlights(e) : []), [e]);
  const isVerb = Boolean(e?.conj && Object.keys(e.conj).length);
  const familySize = data?.family ? data.family.groups.length + data.family.others.length : 0;

  /** A word mentioned on the page, linked when the dictionary has it on this root. */
  const wordLink = (w: string) => {
    const key = normalizeArabic(w);
    const target = data ? [...data.members.values()].find((m) => m.id !== hit.id && normalizeArabic(m.w) === key) : undefined;
    const h = target && byId.get(target.id);
    return h ? (
      <button key={w} type="button" onClick={() => onOpen(h)} className="font-card text-primary underline-offset-4 hover:underline" dir="rtl" lang="ar">{w}</button>
    ) : (
      <span key={w} className="font-card" dir="rtl" lang="ar">{w}</span>
    );
  };

  return (
    <article className="space-y-6">
      <header className="rounded-3xl border border-border bg-card px-6 py-7 flashcard-shadow sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="font-card text-5xl font-bold leading-[1.5] text-foreground sm:text-6xl" dir="rtl" lang="ar">{hit.word}</h1>
              <SpeakButton word={hit.word} size={20} />
            </div>
            {e?.rom && <p className="text-sm italic text-muted-foreground">{e.rom}</p>}
            {hit.gloss && <p className="text-xl font-semibold text-primary">{hit.gloss}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground">
                {posLine({ pos: hit.pos, form: hit.form, gender: e?.gender })}
              </span>
              {hit.root && (
                <button
                  type="button"
                  onClick={() => onOpenRoot(hit.root)}
                  className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground transition-colors hover:border-primary/50"
                >
                  Root <span className="font-arabic text-sm" dir="rtl">{hit.root}</span>
                </button>
              )}
            </div>
          </div>
          {e && <AddButton owned={owned} onAdd={onAdd && (() => onAdd(toNewWord(e, hit.gloss)))} />}
        </div>
      </header>

      {error && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          This entry could not be loaded. Check your connection and try again.
        </p>
      )}
      {!data && !error && (
        <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      )}

      {e && hl.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {hl.map((x) => (
            <div key={x.label} className="rounded-2xl border border-border bg-card px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{x.label}</p>
              <p className="mt-1 flex flex-wrap gap-x-2 text-xl leading-relaxed" dir="rtl">
                {x.words.slice(0, 3).map(wordLink)}
              </p>
              {x.note && <p className="text-xs text-muted-foreground">{x.note}</p>}
            </div>
          ))}
        </div>
      )}

      {e && (
        <Tabs defaultValue="meanings" className="space-y-4">
          <TabsList className="grid h-auto w-full auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-muted/60 p-1">
            <TabsTrigger value="meanings" className="rounded-xl px-2 py-2">Meanings</TabsTrigger>
            {familySize > 1 && <TabsTrigger value="family" className="rounded-xl px-2 py-2">Family</TabsTrigger>}
            {isVerb && <TabsTrigger value="conj" className="rounded-xl px-2 py-2">Tenses</TabsTrigger>}
            {e.ety && <TabsTrigger value="origin" className="rounded-xl px-2 py-2">Origin</TabsTrigger>}
          </TabsList>

          <TabsContent value="meanings" className="mt-0">
            {senses.length ? (
              <ol className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card">
                {senses.map((s, i) => (
                  <li key={i} className={`space-y-2 px-5 py-3.5 ${s.sub ? 'ps-10' : ''}`}>
                    <p className="text-[15px] leading-relaxed text-foreground">
                      {s.labels.map((l) => (
                        <span key={l} className="me-1.5 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{l}</span>
                      ))}
                      {s.g}
                    </p>
                    {s.ex.slice(0, 2).map((x, j) => (
                      <figure key={j} className="rounded-xl bg-background px-4 py-3">
                        {x.ar && <p className="font-card text-xl leading-loose text-foreground" dir="rtl" lang="ar">{x.ar}</p>}
                        {x.en && <p className="text-sm text-muted-foreground">{x.en}</p>}
                        {x.ref && <figcaption className="mt-1 text-[11px] text-muted-foreground/80">{x.ref.replace(/:$/, '')}</figcaption>}
                      </figure>
                    ))}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-2xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
                {e.masdarOf?.length
                  ? <>The verbal noun of {e.masdarOf.map(wordLink)}; see that verb for its meanings.</>
                  : 'No meanings recorded for this word yet.'}
              </p>
            )}
          </TabsContent>

          {familySize > 1 && data?.family && (
            <TabsContent value="family" className="mt-0">
              <FamilyView family={data.family} members={data.members} byId={byId} current={hit.id} deckKeys={deckKeys} onOpen={onOpen} />
            </TabsContent>
          )}

          {isVerb && e.conj && (
            <TabsContent value="conj" className="mt-0">
              <Conjugation conj={e.conj} />
            </TabsContent>
          )}

          {e.ety && (
            <TabsContent value="origin" className="mt-0">
              <p className="rounded-2xl border border-border bg-card px-5 py-4 text-[15px] leading-relaxed text-foreground">{e.ety}</p>
            </TabsContent>
          )}
        </Tabs>
      )}

      {e && (
        <footer className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
          <span>From Wiktionary (CC BY-SA 4.0)</span>
          {hit.slug && (
            <a href={`/word/${hit.slug}/`} className="inline-flex items-center gap-1 hover:text-foreground">
              Public page <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </footer>
      )}
    </article>
  );
};

function Conjugation({ conj }: { conj: Record<string, Record<string, string[]>> }) {
  const moods = MOODS.filter(([m]) => conj[m]);
  const [mood, setMood] = useState(moods[0]?.[0] ?? 'past');
  const table = conj[mood] ?? {};
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {moods.map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMood(m)}
            aria-pressed={mood === m}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              mood === m ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-foreground hover:border-primary/50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card">
        {PRONOUNS.filter(([k]) => table[k]?.length).map(([k, ar, en]) => (
          <div key={k} className="flex items-center gap-3 px-5 py-2.5">
            <span className="w-28 shrink-0 text-xs text-muted-foreground">{en}</span>
            <span className="font-arabic text-sm text-muted-foreground" dir="rtl">{ar}</span>
            <span className="flex-1 text-end font-card text-xl leading-relaxed text-foreground" dir="rtl" lang="ar">{table[k].join(' / ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DictionaryEntryView;
