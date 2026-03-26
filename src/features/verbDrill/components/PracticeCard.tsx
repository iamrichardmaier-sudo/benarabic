import { useState, useEffect } from "react";
import { ArabicVerb, Tense, Mood, PronounKey } from "../engine/types";
import { PRONOUNS } from "../engine/pronouns";
import { getConjugation } from "../engine/conjugate";
import { generateSentence } from "../engine/sentenceGenerator";
import SpeakButton from "@/components/SpeakButton";

interface PracticeCardProps {
  verb: ArabicVerb;
  pronounKey: PronounKey;
  tense: Tense;
  mood: Mood;
  onNext: () => void;
  onResult: (correct: boolean) => void;
}

const PracticeCard = ({ verb, pronounKey, tense, mood, onNext, onResult }: PracticeCardProps) => {
  const [flipped, setFlipped] = useState(false);
  const result = getConjugation(verb, pronounKey, tense, mood);
  const sentence = generateSentence(verb, pronounKey, tense, mood);

  useEffect(() => {
    setFlipped(false);
  }, [pronounKey, tense, verb.base]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped(f => !f);
      }
      if (e.code === "ArrowRight" && flipped) {
        onResult(true);
        onNext();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [flipped, onNext, onResult]);

  return (
    <div className="space-y-4">
      <div
        className="relative cursor-pointer"
        onClick={() => setFlipped(f => !f)}
      >
        <div className={`rounded-2xl border border-border bg-card p-6 min-h-[200px] flex flex-col items-center justify-center transition-all duration-150 ${flipped ? "bg-primary/5" : ""}`}>
          {!flipped ? (
            <div className="text-center space-y-3" dir="rtl">
              <p className="text-sm text-muted-foreground">Conjugate for:</p>
              <p className="text-2xl font-amiri text-foreground">{PRONOUNS[pronounKey].arabic}</p>
              <div className="flex items-center justify-center gap-2">
                <p className="text-xl font-amiri text-primary">{verb.base}</p>
                <SpeakButton word={verb.base} size={18} autoSpeak />
              </div>
              <p className="text-xs text-muted-foreground">{verb.meaning} • {tense}{tense === "present" ? ` (${mood})` : ""}</p>
              <p className="text-sm text-muted-foreground mt-4">Tap to reveal</p>
            </div>
          ) : (
            <div className="text-center space-y-3" dir="rtl">
              <div className="flex items-center justify-center gap-2">
                <p className="text-3xl font-amiri text-foreground">{result.form}</p>
                <SpeakButton word={result.form} size={22} autoSpeak />
              </div>
              <p className="text-sm text-muted-foreground font-amiri">{sentence.sentence.replace("____", result.form)}</p>
              <p className="text-xs text-muted-foreground" dir="ltr">{sentence.translation}</p>
            </div>
          )}
        </div>
      </div>

      {flipped && (
        <div className="flex gap-3">
          <button
            onClick={() => { onResult(false); onNext(); }}
            className="flex-1 py-2.5 rounded-xl bg-destructive/10 text-destructive font-medium transition-all active:scale-95"
          >
            Again
          </button>
          <button
            onClick={() => { onResult(true); onNext(); }}
            className="flex-1 py-2.5 rounded-xl bg-success/10 text-success font-medium transition-all active:scale-95"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
};

export default PracticeCard;
