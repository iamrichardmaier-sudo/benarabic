import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Flame } from 'lucide-react';
import SpeakButton, { speakArabic } from '@/components/SpeakButton';
import { Progress } from '@/components/ui/progress';
import { PluralWord, CATEGORIES, shuffleArray } from '@/lib/plural-word-bank';
import { normalizeArabic, checkPluralAnswer } from '@/lib/arabic-normalize';
import { QuizResult } from './index';

type Difficulty = 'easy' | 'normal' | 'hard';
type FeedbackState = null | { correct: boolean; userAnswer: string; word: PluralWord };

interface QuizScreenProps {
  words: PluralWord[];
  difficulty: Difficulty;
  showTashkeel: boolean;
  onComplete: (results: QuizResult[]) => void;
  onCancel: () => void;
}

function stripTashkeel(str: string): string {
  return str.replace(/[\u064B-\u065F\u0670]/g, '');
}

/** Generate 3 distractors from the same category words */
function getDistractors(currentWord: PluralWord, allWords: PluralWord[]): string[] {
  const sameCategory = allWords.filter(
    w => w.category === currentWord.category && w.singular !== currentWord.singular
  );
  const shuffled = shuffleArray(sameCategory);
  return shuffled.slice(0, 3).map(w => w.plural[0]);
}

const QuizScreen = ({ words, difficulty, showTashkeel, onComplete, onCancel }: QuizScreenProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [streak, setStreak] = useState(0);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  const currentWord = words[currentIndex];
  const category = CATEGORIES.find(c => c.id === currentWord?.category);
  const progress = ((currentIndex + (feedback ? 1 : 0)) / words.length) * 100;

  // Multiple choice options for easy mode
  const mcOptions = useMemo(() => {
    if (difficulty !== 'easy' || !currentWord) return [];
    const distractors = getDistractors(currentWord, words);
    const correct = currentWord.plural[0];
    const options = shuffleArray([correct, ...distractors]);
    return options;
  }, [currentIndex, difficulty, currentWord, words]);

  const displaySingular = useCallback(
    (text: string) => {
      if (!showTashkeel || difficulty === 'hard') return stripTashkeel(text);
      return text;
    },
    [showTashkeel, difficulty]
  );

  const handleSubmit = useCallback(() => {
    if (!userInput.trim() || !currentWord) return;
    const correct = checkPluralAnswer(userInput, currentWord.plural);
    setFeedback({ correct, userAnswer: userInput, word: currentWord });
    setResults(prev => [...prev, { word: currentWord, userAnswer: userInput, correct }]);
    setStreak(prev => (correct ? prev + 1 : 0));
  }, [userInput, currentWord]);

  const handleMCSelect = useCallback(
    (option: string) => {
      if (!currentWord) return;
      const correct = checkPluralAnswer(option, currentWord.plural);
      setFeedback({ correct, userAnswer: option, word: currentWord });
      setResults(prev => [...prev, { word: currentWord, userAnswer: option, correct }]);
      setStreak(prev => (correct ? prev + 1 : 0));
    },
    [currentWord]
  );

  const handleNext = useCallback(() => {
    if (currentIndex + 1 >= words.length) {
      onComplete([...results]);
    } else {
      setCurrentIndex(prev => prev + 1);
      setUserInput('');
      setFeedback(null);
    }
  }, [currentIndex, words.length, results, onComplete]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (feedback) return;
        setShowConfirmCancel(true);
      }
      if (e.key === 'Enter') {
        if (feedback) {
          handleNext();
        } else if (difficulty !== 'easy' && userInput.trim()) {
          handleSubmit();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [feedback, handleNext, handleSubmit, userInput, difficulty]);

  if (!currentWord) return null;

  const isCollective = currentWord.quiz_direction === 'collective';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowConfirmCancel(true)}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <span className="text-sm text-muted-foreground font-medium">
          {currentIndex + 1} / {words.length}
        </span>
      </div>

      <Progress value={progress} className="h-2" />

      {/* Cancel confirmation */}
      {showConfirmCancel && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm text-foreground font-medium">End this quiz?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowConfirmCancel(false)}
              className="flex-1 py-2 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium"
            >
              Continue
            </button>
            <button
              onClick={onCancel}
              className="flex-1 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium"
            >
              End Quiz
            </button>
          </div>
        </div>
      )}

      {/* Category label */}
      <div className="text-center space-y-0.5">
        <p className="text-xs text-muted-foreground">{category?.nameEn}</p>
        <p
          className="text-sm text-muted-foreground"
          dir="rtl"
          style={{ fontFamily: "'Noto Naskh Arabic', Arial, serif" }}
        >
          {category?.nameAr}
        </p>
      </div>

      {/* Collective note */}
      {isCollective && !feedback && (
        <p className="text-center text-sm text-primary font-medium">
          What is the collective form of this word?
        </p>
      )}

      {/* Word card */}
      {!feedback && (
        <>
          <div className="rounded-2xl bg-card border border-border p-8 text-center">
            <p
              dir="rtl"
              className="text-foreground font-bold leading-relaxed"
              style={{
                fontFamily: "'Noto Naskh Arabic', Arial, serif",
                fontSize: '3.5rem',
              }}
            >
              {displaySingular(currentWord.singular)}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {currentWord.english}
              {' '}
              <span className="text-muted-foreground/70">
                ({currentWord.dialect === 'fusha' ? 'فصحى' : currentWord.dialect === 'shaami' ? 'شامي' : 'فصحى / شامي'})
              </span>
            </p>
          </div>

          {/* Input or MC */}
          {difficulty === 'easy' ? (
            <div className="grid grid-cols-2 gap-2">
              {mcOptions.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleMCSelect(option)}
                  className="rounded-xl bg-card border border-border p-4 text-center transition-all hover:border-success active:scale-95"
                  dir="rtl"
                  style={{ fontFamily: "'Noto Naskh Arabic', Arial, serif", fontSize: '1.5rem' }}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="text"
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                placeholder="اكتب الجمع هنا..."
                dir="rtl"
                autoFocus
                className="w-full rounded-xl bg-popover border border-border p-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-success transition-colors"
                style={{
                  fontFamily: "'Noto Naskh Arabic', Arial, serif",
                  fontSize: '1.8rem',
                  textAlign: 'right',
                }}
              />
              <button
                onClick={handleSubmit}
                disabled={!userInput.trim()}
                className="w-full py-3 rounded-xl bg-success text-success-foreground font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                Submit →
              </button>
            </div>
          )}

          {/* Streak */}
          {streak >= 3 && (
            <div className="flex items-center justify-center gap-1.5 text-primary">
              <Flame className="w-5 h-5" />
              <span className="font-semibold text-sm">{streak} streak</span>
            </div>
          )}
        </>
      )}

      {/* Feedback */}
      {feedback && (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
          <div className={`text-center text-lg font-bold ${feedback.correct ? 'text-success' : 'text-primary'}`}>
            {feedback.correct ? '✅ Correct!' : '❌ Incorrect'}
          </div>

          {!feedback.correct && (
            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">
                You wrote:{' '}
                <span
                  dir="rtl"
                  style={{ fontFamily: "'Noto Naskh Arabic', Arial, serif", fontSize: '1.2rem' }}
                >
                  {feedback.userAnswer}
                </span>
              </p>
            </div>
          )}

          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">
              {feedback.correct ? '' : 'Correct: '}
            </p>
            <p
              dir="rtl"
              className="text-success font-bold"
              style={{ fontFamily: "'Noto Naskh Arabic', Arial, serif", fontSize: '2rem' }}
            >
              {feedback.word.plural[0]}
            </p>
            {feedback.word.plural.length > 1 && (
              <p
                dir="rtl"
                className="text-muted-foreground text-sm mt-1"
                style={{ fontFamily: "'Noto Naskh Arabic', Arial, serif" }}
              >
                Also accepted: {feedback.word.plural.slice(1).join(' / ')}
              </p>
            )}
          </div>

          {feedback.word.pattern !== 'suppletive' && (
            <p className="text-center text-sm text-muted-foreground">
              <span className="font-medium">Pattern:</span>{' '}
              <span
                dir="rtl"
                style={{ fontFamily: "'Noto Naskh Arabic', Arial, serif" }}
              >
                {feedback.word.pattern}
              </span>
            </p>
          )}

          <p className="text-center text-sm text-muted-foreground italic">
            {feedback.word.grammar_note}
          </p>

          <button
            onClick={handleNext}
            className="w-full py-3 rounded-xl bg-success text-success-foreground font-semibold transition-all active:scale-95"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default QuizScreen;
