import { ArabicVerb, Tense, Mood, PronounKey, DrillMode } from "../engine/types";
import { VERB_LIBRARY } from "../data/verbLibrary";
import { PRONOUNS, PRONOUN_ORDER } from "../engine/pronouns";
import ModeToggle from "./ModeToggle";

interface SetupPanelProps {
  verb: ArabicVerb | null;
  tense: Tense;
  mood: Mood;
  selectedPronouns: PronounKey[] | "all";
  mode: DrillMode;
  onVerbChange: (verb: ArabicVerb) => void;
  onTenseChange: (tense: Tense) => void;
  onMoodChange: (mood: Mood) => void;
  onPronounChange: (pronouns: PronounKey[] | "all") => void;
  onModeChange: (mode: DrillMode) => void;
  onStart: () => void;
}

const TENSES: { key: Tense; label: string }[] = [
  { key: "past", label: "Past" },
  { key: "present", label: "Present" },
  { key: "future", label: "Future" },
  { key: "imperative", label: "Imperative" },
];

const MOODS: { key: Mood; label: string }[] = [
  { key: "indicative", label: "Indicative" },
  { key: "subjunctive", label: "Subjunctive" },
  { key: "jussive", label: "Jussive" },
];

const SetupPanel = ({
  verb, tense, mood, selectedPronouns, mode,
  onVerbChange, onTenseChange, onMoodChange, onPronounChange, onModeChange, onStart,
}: SetupPanelProps) => {
  const togglePronoun = (key: PronounKey) => {
    if (selectedPronouns === "all") {
      onPronounChange(PRONOUN_ORDER.filter(k => k !== key));
    } else {
      const exists = selectedPronouns.includes(key);
      if (exists) {
        const next = selectedPronouns.filter(k => k !== key);
        onPronounChange(next.length === 0 ? "all" : next);
      } else {
        const next = [...selectedPronouns, key];
        onPronounChange(next.length === PRONOUN_ORDER.length ? "all" : next);
      }
    }
  };

  const isPronounSelected = (key: PronounKey) =>
    selectedPronouns === "all" || selectedPronouns.includes(key);

  return (
    <div className="space-y-6">
      {/* Verb picker */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Choose a verb</label>
        <div className="grid grid-cols-2 gap-2">
          {VERB_LIBRARY.map((v) => (
            <button
              key={v.base}
              onClick={() => onVerbChange(v)}
              className={`p-3 rounded-xl text-right border transition-all duration-150 ${
                verb?.base === v.base
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50"
              }`}
              dir="rtl"
            >
              <span className="block text-lg font-amiri">{v.base}</span>
              <span className="block text-xs mt-0.5 text-muted-foreground">{v.meaning}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tense */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Tense</label>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {TENSES.map((t) => (
            <button
              key={t.key}
              onClick={() => onTenseChange(t.key)}
              className={`flex-1 px-2 py-1.5 text-sm font-medium rounded-md transition-all duration-150 ${
                tense === t.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tense === "present" && (
          <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
            {MOODS.map((m) => (
              <button
                key={m.key}
                onClick={() => onMoodChange(m.key)}
                className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-all duration-150 ${
                  mood === m.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pronouns */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">Pronouns</label>
          <button
            onClick={() => onPronounChange("all")}
            className="text-xs text-primary hover:underline"
          >
            Select all
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5" dir="rtl">
          {PRONOUN_ORDER.map((key) => (
            <button
              key={key}
              onClick={() => togglePronoun(key)}
              className={`px-2.5 py-1 text-sm rounded-lg border transition-all duration-100 font-amiri ${
                isPronounSelected(key)
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {PRONOUNS[key].arabic}
            </button>
          ))}
        </div>
      </div>

      {/* Mode */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Mode</label>
        <ModeToggle mode={mode} onChange={onModeChange} />
      </div>

      {/* Start */}
      <button
        onClick={onStart}
        disabled={!verb}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-base transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
      >
        Start Drill
      </button>
    </div>
  );
};

export default SetupPanel;
