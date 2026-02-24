import { Progress } from '@/components/ui/progress';
import { CATEGORIES } from '@/lib/plural-word-bank';
import { QuizResult } from './index';

interface ResultsScreenProps {
  results: QuizResult[];
  onRetrySame: () => void;
  onNewSetup: () => void;
}

const ResultsScreen = ({ results, onRetrySame, onNewSetup }: ResultsScreenProps) => {
  const correctCount = results.filter(r => r.correct).length;
  const scorePercent = Math.round((correctCount / results.length) * 100);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="text-center space-y-3">
        <h2 className="text-xl font-bold text-foreground">Your Score</h2>
        <p className="text-4xl font-bold text-foreground">
          {correctCount} / {results.length}
        </p>
        <Progress value={scorePercent} className="h-3 mx-auto max-w-xs" />
        <p className="text-sm text-muted-foreground">{scorePercent}%</p>
      </div>

      <div className="border-t border-border" />

      <div className="space-y-3">
        {results.map((result, idx) => {
          const category = CATEGORIES.find(c => c.id === result.word.category);
          return (
            <div
              key={idx}
              className={`rounded-xl p-3 border ${
                result.correct ? 'border-success/30 bg-success/5' : 'border-primary/30 bg-primary/5'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">{result.correct ? '✅' : '❌'}</span>
                  <div className="min-w-0">
                    <p
                      dir="rtl"
                      className="text-foreground font-medium truncate"
                      style={{ fontFamily: "'Noto Naskh Arabic', Arial, serif" }}
                    >
                      {result.word.singular} → {result.word.plural[0]}
                    </p>
                    {!result.correct && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        You wrote:{' '}
                        <span
                          dir="rtl"
                          style={{ fontFamily: "'Noto Naskh Arabic', Arial, serif" }}
                        >
                          {result.userAnswer}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {category?.nameEn?.replace(' Plural', '').replace(' – ', ' ')}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border" />

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onRetrySame}
          className="py-3 rounded-xl bg-secondary text-secondary-foreground font-semibold transition-all active:scale-95"
        >
          Retry Same
        </button>
        <button
          onClick={onNewSetup}
          className="py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95"
        >
          New Setup
        </button>
      </div>
    </div>
  );
};

export default ResultsScreen;
