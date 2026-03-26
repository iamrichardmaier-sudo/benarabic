import { useMemo } from "react";
import { ArabicVerb, Tense, Mood, ConjugationResult } from "../engine/types";
import { PRONOUN_GROUPS } from "../engine/pronouns";
import { buildConjugationTable } from "../engine/conjugate";
import SpeakButton from "@/components/SpeakButton";

interface ConjugationTableProps {
  verb: ArabicVerb;
  tense: Tense;
  mood: Mood;
}

const ConjugationTable = ({ verb, tense, mood }: ConjugationTableProps) => {
  const table = useMemo(() => buildConjugationTable(verb), [verb.base]);

  const getRows = (): ConjugationResult[] => {
    if (tense === "past") return table.past;
    if (tense === "present") return table.present[mood];
    if (tense === "future") return table.future;
    return table.imperative;
  };

  const rows = getRows();

  return (
    <div className="space-y-4" dir="rtl">
      <div className="text-center space-y-1">
        <h3 className="text-2xl font-amiri text-foreground">{verb.base}</h3>
        <p className="text-sm text-muted-foreground">{verb.meaning}</p>
        <p className="text-xs text-muted-foreground">
          Root: {verb.root.join(" - ")}
          {verb.weakType && ` • ${verb.weakType}`}
        </p>
      </div>

      {PRONOUN_GROUPS.map((group) => (
        <div key={group.label} className="space-y-1">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-right" dir="ltr">
            {group.label}
          </h4>
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            {group.keys.map((key) => {
              const row = rows.find(r => r.pronounKey === key);
              if (!row) return null;
              const isDash = row.form === "—";
              return (
                <div
                  key={key}
                  className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 last:border-b-0 hover:bg-muted/30 transition-colors duration-100"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground font-amiri min-w-[3.5rem]">
                      {row.pronoun}
                    </span>
                    <span className={`text-lg font-amiri ${isDash ? "text-muted-foreground" : "text-foreground"}`}>
                      {row.form}
                    </span>
                  </div>
                  {!isDash && (
                    <SpeakButton word={row.form} size={16} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ConjugationTable;
