import { useState, useMemo, useCallback } from "react";
import { ArrowRight } from "lucide-react";
import { ArabicVerb, Tense, Mood, PronounKey, DrillMode } from "./engine/types";
import { PRONOUN_ORDER } from "./engine/pronouns";
import SetupPanel from "./components/SetupPanel";
import ConjugationTable from "./components/ConjugationTable";
import PracticeCard from "./components/PracticeCard";
import AnswerInput from "./components/AnswerInput";

interface VerbDrillTabProps {
  onBack: () => void;
}

type Phase = "setup" | "study" | "practice" | "results";

const VerbDrillTab = ({ onBack }: VerbDrillTabProps) => {
  const [verb, setVerb] = useState<ArabicVerb | null>(null);
  const [tense, setTense] = useState<Tense>("past");
  const [mood, setMood] = useState<Mood>("indicative");
  const [selectedPronouns, setSelectedPronouns] = useState<PronounKey[] | "all">("all");
  const [mode, setMode] = useState<DrillMode>("study");
  const [phase, setPhase] = useState<Phase>("setup");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const drillPronouns = useMemo(() => {
    const keys = selectedPronouns === "all" ? [...PRONOUN_ORDER] : [...selectedPronouns];
    if (tense === "imperative") {
      return keys.filter(k => ["anta", "anti", "antuma", "antum", "antunna"].includes(k));
    }
    // Shuffle for practice modes
    if (mode !== "study") {
      for (let i = keys.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [keys[i], keys[j]] = [keys[j], keys[i]];
      }
    }
    return keys;
  }, [selectedPronouns, tense, mode, phase]);

  const handleStart = () => {
    if (!verb) return;
    setCurrentIndex(0);
    setScore({ correct: 0, total: 0 });
    setPhase(mode === "study" ? "study" : "practice");
  };

  const handleNext = useCallback(() => {
    if (currentIndex < drillPronouns.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      setPhase("results");
    }
  }, [currentIndex, drillPronouns.length]);

  const handleResult = useCallback((correct: boolean) => {
    setScore(s => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
  }, []);

  const currentPronoun = drillPronouns[currentIndex];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={phase === "setup" ? onBack : () => setPhase("setup")}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ArrowRight className="w-5 h-5 rotate-180" />
        </button>
        <h2 className="text-lg font-bold text-foreground">Verb Conjugation Drill</h2>
      </div>

      {phase === "setup" && (
        <SetupPanel
          verb={verb}
          tense={tense}
          mood={mood}
          selectedPronouns={selectedPronouns}
          mode={mode}
          onVerbChange={setVerb}
          onTenseChange={setTense}
          onMoodChange={setMood}
          onPronounChange={setSelectedPronouns}
          onModeChange={setMode}
          onStart={handleStart}
        />
      )}

      {phase === "study" && verb && (
        <ConjugationTable verb={verb} tense={tense} mood={mood} />
      )}

      {phase === "practice" && verb && currentPronoun && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{currentIndex + 1} / {drillPronouns.length}</span>
            <span>{score.correct} correct</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${((currentIndex) / drillPronouns.length) * 100}%` }}
            />
          </div>

          {mode === "flashcard" && (
            <PracticeCard
              verb={verb}
              pronounKey={currentPronoun}
              tense={tense}
              mood={mood}
              onNext={handleNext}
              onResult={handleResult}
            />
          )}

          {(mode === "multipleChoice" || mode === "typeIn") && (
            <AnswerInput
              verb={verb}
              pronounKey={currentPronoun}
              tense={tense}
              mood={mood}
              mode={mode}
              onNext={handleNext}
              onResult={handleResult}
            />
          )}
        </div>
      )}

      {phase === "results" && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4">
          <div className="text-4xl">
            {score.correct === score.total ? "🎉" : score.correct >= score.total * 0.7 ? "👏" : "📚"}
          </div>
          <h3 className="text-xl font-bold text-foreground">Drill Complete!</h3>
          <p className="text-3xl font-bold text-primary">
            {score.correct} / {score.total}
          </p>
          <p className="text-sm text-muted-foreground">
            {score.correct === score.total
              ? "Perfect score! Excellent work!"
              : score.correct >= score.total * 0.7
              ? "Great job! Keep practicing!"
              : "Keep at it — practice makes perfect!"}
          </p>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => { setCurrentIndex(0); setScore({ correct: 0, total: 0 }); setPhase("practice"); }}
              className="flex-1 py-2.5 rounded-xl bg-secondary text-secondary-foreground font-medium transition-all active:scale-95"
            >
              Retry
            </button>
            <button
              onClick={() => setPhase("setup")}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium transition-all active:scale-95"
            >
              New Drill
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerbDrillTab;
