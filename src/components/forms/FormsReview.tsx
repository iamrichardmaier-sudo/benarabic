import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { dropConjugationCache, formsTable, type Conjugation } from '@/lib/verb-forms/data';

interface FormsReviewProps {
  rows: Conjugation[];
  onChanged: () => void;
}

type Draft = { past: string; present: string; masdar: string; meaning: string; tier: number };

/**
 * The admin's checklist: every stored paradigm the generator or the deck could
 * not vouch for. Approving writes "high" and stamps who checked it; until
 * then the quizzes ignore the row.
 */
const FormsReview = ({ rows, onChanged }: FormsReviewProps) => {
  const { user } = useAuth();
  const todo = rows
    .filter((r) => r.confidence !== 'high')
    .sort((a, b) => b.tier - a.tier || a.root.localeCompare(b.root, 'ar'));
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setError(null), [rows]);

  const draft = (r: Conjugation): Draft =>
    drafts[r.id] ?? { past: r.past, present: r.present, masdar: r.masdar ?? '', meaning: r.meaning ?? '', tier: r.tier };
  const edit = (r: Conjugation, patch: Partial<Draft>) => setDrafts({ ...drafts, [r.id]: { ...draft(r), ...patch } });

  const save = async (r: Conjugation, confidence: 'high' | 'low') => {
    const d = draft(r);
    setBusy(r.id);
    setError(null);
    const { error: err } = await formsTable('verb_conjugations')
      .update({
        past: d.past.trim(),
        present: d.present.trim(),
        masdar: d.masdar.trim() || null,
        meaning_en: d.meaning.trim() || null,
        usage_tier: d.tier,
        confidence,
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      } as never)
      .eq('id', r.id);
    setBusy(null);
    if (err) return setError(err.message);
    dropConjugationCache();
    onChanged();
  };

  if (todo.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing waiting for review.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{todo.length} to check. Quizzes skip these until you approve them.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {todo.map((r) => {
        const d = draft(r);
        const field = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm';
        return (
          <div key={r.id} className="space-y-2 rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              <span className="font-arabic text-sm" dir="rtl">{r.root}</span> · Form {r.form} · {r.weak} · {r.confidence} · {r.source}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input className={`${field} font-arabic`} dir="rtl" aria-label="Past" value={d.past} onChange={(e) => edit(r, { past: e.target.value })} />
              <input className={`${field} font-arabic`} dir="rtl" aria-label="Present" value={d.present} onChange={(e) => edit(r, { present: e.target.value })} />
              <input className={`${field} font-arabic`} dir="rtl" aria-label="Verbal noun" value={d.masdar} onChange={(e) => edit(r, { masdar: e.target.value })} />
              <input className={field} aria-label="Meaning" value={d.meaning} onChange={(e) => edit(r, { meaning: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground" htmlFor={`tier-${r.id}`}>Usage</label>
              <select id={`tier-${r.id}`} className="rounded-lg border border-border bg-background px-2 py-1 text-sm" value={d.tier} onChange={(e) => edit(r, { tier: Number(e.target.value) })}>
                {[0, 1, 2, 3, 4].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <span className="flex-1" />
              <button disabled={busy === r.id} onClick={() => save(r, 'low')} className="rounded-lg border border-border px-3 py-1.5 text-sm">Keep out</button>
              <button disabled={busy === r.id} onClick={() => save(r, 'high')} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">
                {busy === r.id && <Loader2 className="h-3 w-3 animate-spin" />}Approve
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FormsReview;
