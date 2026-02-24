import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import SetupScreen from './SetupScreen';
import QuizScreen from './QuizScreen';
import ResultsScreen from './ResultsScreen';
import { CategoryId, Dialect, PluralWord, getFilteredWords, shuffleArray } from '@/lib/plural-word-bank';

type Difficulty = 'easy' | 'normal' | 'hard';
type Phase = 'setup' | 'quiz' | 'results';

export interface QuizResult {
  word: PluralWord;
  userAnswer: string;
  correct: boolean;
}

interface PluralDrillProps {
  onBack: () => void;
}

const PluralDrill = ({ onBack }: PluralDrillProps) => {
  const [phase, setPhase] = useState<Phase>('setup');
  const [quizWords, setQuizWords] = useState<PluralWord[]>([]);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [showTashkeel, setShowTashkeel] = useState(true);
  const [lastSetup, setLastSetup] = useState<{
    categories: CategoryId[];
    dialect: Dialect;
    count: number;
    difficulty: Difficulty;
    showTashkeel: boolean;
  } | null>(null);

  const handleStart = (
    categories: CategoryId[],
    dialect: Dialect,
    count: number,
    diff: Difficulty,
    tashkeel: boolean
  ) => {
    const filtered = getFilteredWords(categories, dialect);
    const shuffled = shuffleArray(filtered).slice(0, count);
    setQuizWords(shuffled);
    setResults([]);
    setDifficulty(diff);
    setShowTashkeel(tashkeel);
    setLastSetup({ categories, dialect, count, difficulty: diff, showTashkeel: tashkeel });
    setPhase('quiz');
  };

  const handleQuizComplete = (quizResults: QuizResult[]) => {
    setResults(quizResults);
    setPhase('results');
  };

  const handleRetrySame = () => {
    if (lastSetup) {
      const filtered = getFilteredWords(lastSetup.categories, lastSetup.dialect);
      const shuffled = shuffleArray(filtered).slice(0, lastSetup.count);
      setQuizWords(shuffled);
      setResults([]);
      setPhase('quiz');
    }
  };

  const handleNewSetup = () => {
    setPhase('setup');
  };

  return (
    <div className="space-y-4">
      {phase === 'setup' && (
        <>
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <h2 className="text-xl font-bold text-foreground">Drill Plurals</h2>
          <SetupScreen onStart={handleStart} />
        </>
      )}

      {phase === 'quiz' && (
        <QuizScreen
          words={quizWords}
          difficulty={difficulty}
          showTashkeel={showTashkeel}
          onComplete={handleQuizComplete}
          onCancel={() => setPhase('setup')}
        />
      )}

      {phase === 'results' && (
        <ResultsScreen
          results={results}
          onRetrySame={handleRetrySame}
          onNewSetup={handleNewSetup}
        />
      )}
    </div>
  );
};

export default PluralDrill;
