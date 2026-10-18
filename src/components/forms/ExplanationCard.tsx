import type { Explanation } from '@/lib/verb-forms/quiz';

/** The learner's reason to trust the answer: root, form, the clue, the effect. */
const ExplanationCard = ({ e }: { e: Explanation }) => (
  <div className="space-y-3 rounded-2xl border border-border bg-card p-4 text-sm">
    <div className="flex items-baseline justify-between gap-3">
      <span className="font-arabic text-2xl" dir="rtl">{e.past}</span>
      <span className="text-xs text-muted-foreground">Root {e.root}{e.rootMeaning ? ` · ${e.rootMeaning}` : ''}</span>
    </div>
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      <dt className="text-muted-foreground">Present</dt>
      <dd className="font-arabic text-base" dir="rtl">{e.present}</dd>
      {e.masdar && (
        <>
          <dt className="text-muted-foreground">Verbal noun</dt>
          <dd className="font-arabic text-base" dir="rtl">{e.masdar}</dd>
        </>
      )}
      {e.meaning && (
        <>
          <dt className="text-muted-foreground">Meaning</dt>
          <dd>{e.meaning}</dd>
        </>
      )}
    </dl>
    <div className="space-y-1 border-t border-border pt-3">
      <p className="font-semibold text-foreground">
        Form {e.form} <span className="font-arabic font-normal" dir="rtl">{e.pattern}</span> · {e.summary}
      </p>
      <p className="text-muted-foreground">{e.detail}</p>
      <p className="text-foreground"><span className="font-semibold">Look for:</span> {e.clue}</p>
    </div>
  </div>
);

export default ExplanationCard;
