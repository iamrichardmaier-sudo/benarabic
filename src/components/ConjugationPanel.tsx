import Say from '@/components/Say';
import { useEffect, useState } from 'react';
import { ChevronUp, Loader2, Table2 } from 'lucide-react';
import type { FlashCard } from '@/lib/spaced-repetition';
import {
  DUAL, PRONOUN, SHAAMI_ORDER, SHAAMI_PRONOUN, TABLE_ORDER, type Participle, type VerbTable,
} from '@/lib/verb-table';
import { hasVerbTable, tablesForCard } from '@/lib/verb-entries';

interface ConjugationPanelProps {
  card: FlashCard;
  className?: string;
}

/**
 * The "Conjugate" button on the back of a card, and the table it opens.
 *
 * Hidden until pressed: the back of the card looks as it always did, with one
 * button at the top. Pressing it shows, for each verb the card belongs to, the
 * definite masdar, the past (left) and present (right) in every person with
 * the duals at the bottom, and the two participles with their English — a
 * participle the language does not use still shown, marked as such.
 *
 * Taps inside the panel stay inside it: the card underneath flips on a tap.
 */
const ConjugationPanel = ({ card, className = '' }: ConjugationPanelProps) => {
  const [open, setOpen] = useState(false);
  const [tables, setTables] = useState<VerbTable[] | null>(null);
  const [error, setError] = useState(false);

  // A new card starts closed.
  useEffect(() => {
    setOpen(false);
    setTables(null);
    setError(false);
  }, [card.id]);

  useEffect(() => {
    if (!open || tables) return;
    let cancelled = false;
    tablesForCard(card)
      .then((t) => { if (!cancelled) setTables(t); })
      .catch((err) => {
        console.error('Could not load the conjugation table:', err);
        if (!cancelled) setError(true);
      });
    return () => { cancelled = true; };
  }, [open, tables, card]);

  if (!hasVerbTable(card)) return null;

  const isVerb = card.wordType === 'verb';
  const label = open ? 'Hide table' : isVerb || !tables?.[0] ? 'Conjugate' : `Conjugate ${tables[0].past}`;

  return (
    <div
      className={`w-full ${className}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            open
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-muted/60 text-primary hover:bg-muted'
          }`}
        >
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
          {label}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-5 text-start cursor-default" data-testid="conjugation-panel">
          {error ? (
            <p className="text-sm text-muted-foreground text-center">The table could not be loaded. Check your connection and try again.</p>
          ) : !tables ? (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading the table…
            </p>
          ) : tables.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center">No table is available for this word yet.</p>
          ) : (
            tables.map((t, i) => <VerbTableView key={`${t.past}-${i}`} table={t} showHead={!isVerb || tables.length > 1} />)
          )}
        </div>
      )}
    </div>
  );
};

const VerbTableView = ({ table, showHead }: { table: VerbTable; showHead: boolean }) => {
  const singularPlural = TABLE_ORDER.filter((id) => !DUAL.has(id));
  const duals = TABLE_ORDER.filter((id) => DUAL.has(id));
  const row = (id: (typeof TABLE_ORDER)[number]) => (
    <tr key={id} className="border-t border-border/60">
      <td className="py-1 px-1 text-center font-card text-lg text-foreground" dir="rtl"><Say>{table.pastChart[id]}</Say></td>
      <td className="py-1 px-1 text-center font-card text-sm text-muted-foreground whitespace-nowrap" dir="rtl">
        {PRONOUN[id]}{id === 'huma_m' ? ' (m)' : id === 'huma_f' ? ' (f)' : ''}
      </td>
      <td className="py-1 px-1 text-center font-card text-lg text-foreground" dir="rtl">
        {table.presentChart ? <Say>{table.presentChart[id]}</Say> : '—'}
      </td>
    </tr>
  );

  return (
    <section className="rounded-xl border border-border/70 bg-background/60 p-3" dir="ltr">
      {showHead && (
        <p className="mb-1 text-center text-xs text-muted-foreground">
          <Say text={table.past} className="font-card text-base text-foreground"><span dir="rtl">{table.past}</span></Say>
          {table.present && <> · <Say text={table.present} className="font-card text-base text-foreground"><span dir="rtl">{table.present}</span></Say></>}
          {table.english && <> · {table.english}</>}
        </p>
      )}
      <div className={`border-b border-border/60 pb-2 text-center ${table.highlight === 'masdar' ? 'rounded-lg bg-primary/10' : ''}`}>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Masdar</p>
        <p className="font-card text-2xl text-foreground" dir="rtl"><Say text={table.masdar} icon>{table.masdar ?? '—'}</Say></p>
      </div>
      <table className="mt-1 w-full table-fixed border-collapse">
        <thead>
          <tr>
            <th className="w-[42%] py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Past</th>
            <th className="w-[16%]" />
            <th className="w-[42%] py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Present</th>
          </tr>
        </thead>
        <tbody>
          {singularPlural.map(row)}
          <tr>
            <td colSpan={3} className="pt-2 pb-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dual</td>
          </tr>
          {duals.map(row)}
        </tbody>
      </table>
      {table.shaami && (
        <div className="mt-3 border-t border-border/60 pt-2">
          <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Shaami</p>
          <table className="mt-1 w-full table-fixed border-collapse">
            <tbody>
              {SHAAMI_ORDER.map((id) => (
                <tr key={id} className="border-t border-border/60">
                  <td className="w-[42%] py-1 px-1 text-center font-card text-lg text-foreground" dir="rtl"><Say text={table.shaami?.past[id]} voice="ar-shami">{table.shaami?.past[id] ?? '—'}</Say></td>
                  <td className="w-[16%] py-1 px-1 text-center font-card text-sm text-muted-foreground whitespace-nowrap" dir="rtl">{SHAAMI_PRONOUN[id]}</td>
                  <td className="w-[42%] py-1 px-1 text-center font-card text-lg text-foreground" dir="rtl"><Say text={table.shaami?.present[id]} voice="ar-shami">{table.shaami?.present[id] ?? '—'}</Say></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3 space-y-1.5 border-t border-border/60 pt-2">
        <ParticipleRow label="Active participle" p={table.active} marked={table.highlight === 'active'} />
        <ParticipleRow label="Passive participle" p={table.passive} marked={table.highlight === 'passive'} />
      </div>
    </section>
  );
};

/** One participle: Arabic, then its English in parentheses, or that it is not used. */
export function participleNote(p: Participle): string {
  if (p.exists) return p.en ? `(${p.en})` : '';
  return p.en ? `(would be “${p.en}” · does not exist)` : '(does not exist)';
}

const ParticipleRow = ({ label, p, marked }: { label: string; p: Participle; marked: boolean }) => (
  <div className={`flex items-baseline justify-between gap-3 rounded-lg px-1 ${marked ? 'bg-primary/10' : ''}`}>
    <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
    <span className="min-w-0 text-end">
      {p.ar && <Say text={p.ar} className="font-card text-xl text-foreground"><span dir="rtl">{p.ar}</span></Say>}{' '}
      <span className={`text-xs ${p.exists ? 'text-muted-foreground' : 'text-warning'}`}>{participleNote(p)}</span>
    </span>
  </div>
);

export default ConjugationPanel;
