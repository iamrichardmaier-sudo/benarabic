import { Check } from 'lucide-react';
import { normalizeArabic } from '@/lib/arabic-normalize';
import { POS_LABEL, type DictEntry, type DictHit, type Family } from '@/lib/ref-dictionary';
import { cn } from '@/lib/utils';

interface Props {
  family: Family;
  members: Map<number, DictEntry>;
  byId: Map<number, DictHit>;
  /** The entry being read, marked rather than linked. */
  current?: number;
  deckKeys: Set<string>;
  onOpen: (hit: DictHit) => void;
}

const ROLE: Record<string, string> = {
  'verbal noun': 'Verbal noun',
  'active participle': 'Active participle',
  'passive participle': 'Passive participle',
  'from this verb': 'Related',
};

/**
 * A root's words the way the language organises them: each verb, in form
 * order, with the verbal nouns and participles that belong to it, then the
 * root's other words. The grouping is the dictionary pages' own (family() in
 * scripts/seo/lib/dictionary.mjs), so the app and the pages agree.
 */
const FamilyView = ({ family, members, byId, current, deckKeys, onOpen }: Props) => {
  const chip = (id: number | null, word: string, label?: string) => {
    const hit = id !== null ? byId.get(id) : undefined;
    const owned = deckKeys.has(normalizeArabic(word));
    const here = id === current;
    const body = (
      <>
        <span className="flex items-center gap-1.5">
          <span className="font-card text-xl leading-relaxed" dir="rtl" lang="ar">{word}</span>
          {owned && <Check className="h-3.5 w-3.5 text-success" aria-label="In your deck" />}
        </span>
        <span className="block max-w-[11rem] truncate text-[11px] text-muted-foreground">
          {label ?? hit?.gloss ?? ''}
        </span>
      </>
    );
    return hit && !here ? (
      <button
        key={`${id}-${word}`}
        type="button"
        onClick={() => onOpen(hit)}
        className="rounded-xl border border-border bg-background px-3 py-1.5 text-start transition-colors hover:border-primary/50"
      >
        {body}
      </button>
    ) : (
      <span
        key={`${id}-${word}`}
        className={cn('rounded-xl border px-3 py-1.5', here ? 'border-primary/60 bg-primary/5' : 'border-dashed border-border')}
      >
        {body}
      </span>
    );
  };

  return (
    <div className="space-y-3">
      {family.groups.map((g) => {
        const verb = members.get(g.verb);
        const vh = byId.get(g.verb);
        if (!verb) return null;
        return (
          <div key={g.verb} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Form {verb.form ?? '—'}
              </span>
              <span className="truncate text-xs text-muted-foreground">{vh?.gloss}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-start gap-2" dir="rtl">
              {chip(g.verb, verb.w, 'verb')}
              {/* Wiktionary sometimes lists one word twice under a verb (two
                  etymologies of the same participle); show it once. */}
              {g.connected
                .filter(([word, role], i, all) => all.findIndex(([w2, r2]) => w2 === word && r2 === role) === i)
                .map(([word, role, id]) => chip(id, word, ROLE[role] ?? role))}
            </div>
          </div>
        );
      })}
      {family.others.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Other words on this root</span>
          <div className="mt-2 flex flex-wrap items-start gap-2" dir="rtl">
            {family.others.map((id) => {
              const m = members.get(id);
              return m ? chip(id, m.w, byId.get(id)?.gloss || POS_LABEL[m.pos]) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default FamilyView;
