import { Check, Plus } from 'lucide-react';
import { useState } from 'react';
import type { DictHit } from '@/lib/ref-dictionary';
import { posLine } from '@/lib/ref-dictionary-cards';
import { cn } from '@/lib/utils';

/** Add to flashcards, or say it is already there. */
export function AddButton({
  owned, onAdd, size = 'md', className,
}: { owned: boolean; onAdd?: () => Promise<void>; size?: 'sm' | 'md'; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (owned || done) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-success/10 font-medium text-success',
          size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-2.5 text-sm',
          className,
        )}
      >
        <Check className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        In your deck
      </span>
    );
  }
  if (!onAdd) return null;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async (ev) => {
        ev.stopPropagation();
        setBusy(true);
        try {
          await onAdd();
          setDone(true);
        } finally {
          setBusy(false);
        }
      }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-primary font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-5 py-2.5 text-sm',
        className,
      )}
    >
      <Plus className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      {size === 'sm' ? 'Add' : 'Add to flashcards'}
    </button>
  );
}

/** One dictionary word in a list. */
export function HitRow({
  hit, owned, onOpen, trailing,
}: { hit: DictHit; owned: boolean; onOpen: () => void; trailing?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-start">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{hit.gloss || '—'}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {posLine(hit)}
            {hit.root && <> · <span dir="rtl" className="font-arabic">{hit.root}</span></>}
          </span>
        </span>
        <span className="font-card shrink-0 text-2xl leading-relaxed text-foreground" dir="rtl" lang="ar">{hit.word}</span>
      </button>
      {trailing ?? (owned && <Check className="h-4 w-4 shrink-0 text-success" aria-label="In your deck" />)}
    </div>
  );
}

/** A small titled panel, the dictionary's one container style. */
export function Panel({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-2', className)}>
      {title && <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">{children}</div>
    </section>
  );
}
