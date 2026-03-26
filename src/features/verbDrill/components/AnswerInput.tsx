import { useState, useEffect, useRef } from "react";
import { ArabicVerb, Tense, Mood, PronounKey } from "../engine/types";
import { PRONOUNS } from "../engine/pronouns";
import { getConjugation } from "../engine/conjugate";
import { generateChoices } from "../engine/choiceGenerator";
import { generateSentence } from "../engine/sentenceGenerator";
import { normalizeArabic } from "@/lib/arabic-normalize";
import SpeakButton from "@/components/SpeakButton";

interface AnswerInputProps {
  verb: ArabicVerb;
  pronounKey: PronounKey;
  tense: Tense;
  mood: Mood;
  mode: "multipleChoice" | "typeIn";
  onNext: () => void;
  onResult: (correct: boolean) => void;
}

const AnswerInput = ({ verb, pronounKey, tense, mood, mode, onNext, onResult }: AnswerInputProps) => {
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const result = getConjugation(verb, pronounKey, tense, mood);
  const sentence = generateSentence(verb, pronounKey, tense, mood);
  const choices = useState(() =>
    generateChoices(result.form, verb, tense === "past" ? "past" : "present")
  )[0];

  useEffect(() => {
    setInput("");
    setFeedback(null);
    setAttempts(0);
    setSelectedChoice(null);
    if (mode === "typeIn") inputRef.current?.focus();
  }, [pronounKey, tense, verb.base, mode]);

  const checkAnswer = (answer: string) => {
    const normalized = normalizeArabic(answer.trim());
    const correct = normalizeArabic(result.form);
    return normalized === correct;
  };

  const handleSubmit = () => {
    if (!input.trim()) return;
    const isCorrect = checkAnswer(input);
    setFeedback(isCorrect ? "correct" : "incorrect");
    if (isCorrect) {
      onResult(true);
    } else {
      setAttempts(a => a + 1);
      if (attempts >= 1) {
        onResult(false);
      }
    }
  };

  const handleChoice = (choice: string) => {
    setSelectedChoice(choice);
    const isCorrect = normalizeArabic(choice) === normalizeArabic(result.form);
    setFeedback(isCorrect ? "correct" : "incorrect");
    onResult(isCorrect);
  };

  const handleContinue = () => {
    onNext();
  };

  const showCorrectAnswer = feedback === "incorrect" && (mode === "multipleChoice" || attempts >= 2);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-3" dir="rtl">
        <p className="text-sm text-muted-foreground">Conjugate for:</p>
        <p className="text-2xl font-amiri text-foreground">{PRONOUNS[pronounKey].arabic}</p>
        <div className="flex items-center justify-center gap-2">
          <p className="text-xl font-amiri text-primary">{verb.base}</p>
          <SpeakButton word={verb.base} size={18} autoSpeak />
        </div>
        <p className="text-xs text-muted-foreground">{verb.meaning} • {tense}</p>
      </div>

      {mode === "multipleChoice" && (
        <div className="grid grid-cols-2 gap-2" dir="rtl">
          {choices.map((choice, i) => {
            const isSelected = selectedChoice === choice;
            const isCorrectChoice = normalizeArabic(choice) === normalizeArabic(result.form);
            let style = "border-border bg-card text-foreground hover:border-primary/50";
            if (feedback) {
              if (isCorrectChoice) style = "border-success bg-success/10 text-success";
              else if (isSelected && !isCorrectChoice) style = "border-destructive bg-destructive/10 text-destructive";
            }
            return (
              <button
                key={i}
                onClick={() => !feedback && handleChoice(choice)}
                disabled={!!feedback}
                className={`p-3 rounded-xl border text-lg font-amiri transition-all duration-100 ${style}`}
              >
                {choice}
              </button>
            );
          })}
        </div>
      )}

      {mode === "typeIn" && (
        <div className="space-y-3">
          <div className="relative">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !feedback && handleSubmit()}
              disabled={!!feedback}
              dir="rtl"
              className={`w-full p-3 text-xl font-amiri text-center rounded-xl border bg-background transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-ring ${
                feedback === "correct"
                  ? "border-success bg-success/5 text-success"
                  : feedback === "incorrect"
                  ? "border-destructive bg-destructive/5 text-destructive"
                  : "border-input"
              }`}
              placeholder="اكتب الإجابة..."
            />
          </div>
          {!feedback && (
            <button
              onClick={handleSubmit}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium transition-all active:scale-95"
            >
              Check
            </button>
          )}
        </div>
      )}

      {feedback && (
        <div className="space-y-3">
          {showCorrectAnswer && (
            <div className="rounded-xl bg-muted/50 p-3 text-center space-y-1" dir="rtl">
              <p className="text-xs text-muted-foreground">Correct answer:</p>
              <div className="flex items-center justify-center gap-2">
                <p className="text-xl font-amiri text-foreground">{result.form}</p>
                <SpeakButton word={result.form} size={18} autoSpeak />
              </div>
            </div>
          )}
          {feedback === "correct" && (
            <div className="flex items-center justify-center gap-2" dir="rtl">
              <SpeakButton word={result.form} size={18} autoSpeak />
              <p className="text-sm text-success font-medium">Correct!</p>
            </div>
          )}
          <button
            onClick={handleContinue}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium transition-all active:scale-95"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default AnswerInput;
