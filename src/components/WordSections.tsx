import Say from '@/components/Say';
/**
 * The section and row shapes a word is described in.
 *
 * Shared by the flashcard's answer side and the reader's word popover so a
 * word reads the same wherever it is met — a label on the left, the Arabic on
 * the right, under a small capitalised heading. They were duplicated before,
 * which is how the reader ended up with a different-looking panel.
 */
export function Row({ label, value }: { label: string; value: string }) {
  // A Shaami row is read by the Shaami voice; everything else by the Fusha one.
  const voice = /^shaami/i.test(label) ? 'ar-shami' : 'ar';
  return (
    <div className="flex items-baseline justify-between gap-4 py-0.5">
      <span className="text-xs leading-snug text-muted-foreground">{label}</span>
      <Say text={value} voice={voice} icon className="font-arabic text-lg leading-snug text-foreground">
        <span dir="rtl">{value}</span>
      </Say>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border/60 pt-2.5">
      <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
        {title}
      </h4>
      {children}
    </div>
  );
}
