import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { FlashCard, graduateCard } from '@/lib/spaced-repetition';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Check, X, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface LearningModeProps {
  cards: FlashCard[];
  allCards: FlashCard[];
  onUpdateCard: (id: string, updates: Partial<FlashCard>) => void;
  onBack: () => void;
}

type AnswerState =
  | { type: 'unanswered' }
  | { type: 'correct' }
  | { type: 'wrong'; correctAnswer: string }
  | { type: 'compare'; userAnswer: string; correctAnswer: string };

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const LearningMode = ({ cards, allCards, onUpdateCard, onBack }: LearningModeProps) => {
  const stage1Cards = useMemo(() => cards.filter((c) => c.learningStage === 'new' || c.learningStage === 'stage1'), [cards]);
  const stage2Cards = useMemo(() => cards.filter((c) => c.learningStage === 'stage2'), [cards]);

  const [currentStage, setCurrentStage] = useState<1 | 2>(stage1Cards.length > 0 ? 1 : 2);
  const [queue, setQueue] = useState<FlashCard[]>(() => shuffleArray(stage1Cards.length > 0 ? stage1Cards : stage2Cards));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerState, setAnswerState] = useState<AnswerState>({ type: 'unanswered' });
  const [typingInput, setTypingInput] = useState('');
  const [completedStage1, setCompletedStage1] = useState(0);
  const [completedStage2, setCompletedStage2] = useState(0);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentCard = queue[currentIndex];
  const totalLearnable = cards.length;
  const isComplete = !currentCard && (queue.length === 0 || currentIndex >= queue.length);
  const allDone = isComplete && (currentStage === 2 || stage2Cards.length === 0);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  }, []);

  // Generate MC options (Arabic words) for stage 1
  const mcOptions = useMemo(() => {
    if (!currentCard || currentStage !== 1) return [];
    const correct = currentCard.word;
    const others = allCards
      .filter((c) => c.id !== currentCard.id && c.word)
      .map((c) => c.word);
    const shuffledOthers = shuffleArray(others).slice(0, 3);
    const fallbacks = ['ماء', 'بيت', 'شجرة', 'شمس', 'طريق', 'طائر'];
    while (shuffledOthers.length < 3) {
      const fb = fallbacks.shift();
      if (fb && fb !== correct) shuffledOthers.push(fb);
      else if (!fb) break;
    }
    return shuffleArray([correct, ...shuffledOthers]);
  }, [currentCard, currentStage, allCards]);

  const advanceToNext = useCallback(() => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    setAnswerState({ type: 'unanswered' });
    setTypingInput('');
    if (currentIndex + 1 < queue.length) {
      setCurrentIndex((i) => i + 1);
    } else if (currentStage === 1) {
      const newStage2 = cards.filter((c) => c.learningStage === 'stage2');
      if (newStage2.length > 0) {
        setCurrentStage(2);
        setQueue(shuffleArray(newStage2));
        setCurrentIndex(0);
      }
    }
  }, [currentIndex, queue.length, currentStage, cards]);

  const autoAdvance = useCallback((delayMs: number) => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    autoAdvanceTimer.current = setTimeout(() => {
      advanceToNext();
    }, delayMs);
  }, [advanceToNext]);

  const handleMCAnswer = (selected: string) => {
    const correct = currentCard.word;
    const isCorrect = selected === correct;
    onUpdateCard(currentCard.id, {
      stage1Attempts: currentCard.stage1Attempts + 1,
      ...(isCorrect
        ? { learningStage: 'stage2' as const }
        : { learningStage: 'stage1' as const }),
    });
    if (isCorrect) {
      setCompletedStage1((n) => n + 1);
      setAnswerState({ type: 'correct' });
      autoAdvance(2000);
    } else {
      setAnswerState({ type: 'wrong', correctAnswer: correct });
      setQueue((q) => [...q, currentCard]);
      autoAdvance(3000);
    }
  };

  const handleTypingCheck = () => {
    const correct = currentCard.word.trim();
    const userAnswer = typingInput.trim();
    onUpdateCard(currentCard.id, { stage2Attempts: currentCard.stage2Attempts + 1 });

    if (userAnswer === correct) {
      // Exact match
      const graduated = graduateCard(currentCard);
      onUpdateCard(currentCard.id, {
        learningStage: graduated.learningStage,
        nextReviewDate: graduated.nextReviewDate,
        intervalDays: graduated.intervalDays,
        easeFactor: graduated.easeFactor,
      });
      setCompletedStage2((n) => n + 1);
      setAnswerState({ type: 'correct' });
    } else {
      // Always show manual override
      setAnswerState({ type: 'compare', userAnswer, correctAnswer: correct });
    }
  };

  const handleCloseEnough = () => {
    const graduated = graduateCard(currentCard);
    onUpdateCard(currentCard.id, {
      learningStage: graduated.learningStage,
      nextReviewDate: graduated.nextReviewDate,
      intervalDays: graduated.intervalDays,
      easeFactor: graduated.easeFactor,
    });
    setCompletedStage2((n) => n + 1);
    setAnswerState({ type: 'correct' });
  };

  const handleTryAgain = () => {
    setQueue((q) => [...q, currentCard]);
    setAnswerState({ type: 'unanswered' });
    setTypingInput('');
    setCurrentIndex((i) => i + 1);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts for manual override screen
  useEffect(() => {
    if (answerState.type !== 'compare') return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleCloseEnough();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleTryAgain();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [answerState]);

  // Prompt display: image + English together, or English only
  const PromptDisplay = ({ card }: { card: FlashCard }) => (
    <div className="rounded-2xl bg-card flashcard-shadow border border-border/50 p-6 flex flex-col items-center justify-center min-h-[200px] gap-3">
      {card.imageUrl && (
        <img
          src={card.imageUrl}
          alt={card.english || card.word}
          className="max-w-[400px] w-full rounded-xl object-cover aspect-video"
        />
      )}
      {card.english && (
        <p
          className={card.imageUrl
            ? "text-2xl text-muted-foreground"
            : "text-[48px] font-bold text-muted-foreground"
          }
        >
          {card.english}
        </p>
      )}
      {!card.imageUrl && !card.english && (
        <p className="text-[48px] font-bold text-muted-foreground">—</p>
      )}
    </div>
  );

  // Completion screen
  if (allDone || (!currentCard && currentStage === 2)) {
    return (
      <div className="w-full max-w-md mx-auto space-y-6 text-center">
        <div className="rounded-2xl bg-card flashcard-shadow p-8 space-y-4">
          <Sparkles className="w-12 h-12 text-success mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Excellent!</h2>
          <p className="text-muted-foreground">
            These {totalLearnable} words will appear in tomorrow's review.
          </p>
        </div>
        <button
          onClick={onBack}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95"
        >
          Back to Home
        </button>
      </div>
    );
  }

  // Auto-transition from stage 1 to stage 2
  if (!currentCard && currentStage === 1) {
    const newStage2 = cards.filter((c) => c.learningStage === 'stage2');
    if (newStage2.length > 0) {
      setTimeout(() => {
        setCurrentStage(2);
        setQueue(shuffleArray(newStage2));
        setCurrentIndex(0);
        setAnswerState({ type: 'unanswered' });
      }, 0);
    }
    return null;
  }

  if (!currentCard) return null;

  const stageLabel = currentStage === 1 ? 'Stage 1: Multiple Choice' : 'Stage 2: Type in Arabic';
  const completed = currentStage === 1 ? completedStage1 : completedStage2;
  const stageTotal = currentStage === 1 ? stage1Cards.length : totalLearnable;
  const remaining = stageTotal - completed;
  const progressPct = stageTotal > 0 ? Math.round((completed / stageTotal) * 100) : 0;

  return (
    <div className="w-full max-w-md mx-auto space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{stageLabel}</span>
          <span className="font-medium text-foreground">{completed}/{stageTotal}</span>
        </div>
        <Progress value={progressPct} className="h-2" />
        <p className="text-xs text-muted-foreground">{remaining} words left in this stage</p>
      </div>

      {/* Prompt: show image or English */}
      <PromptDisplay card={currentCard} />

      {/* Stage 1: Multiple Choice (Arabic options) */}
      {currentStage === 1 && answerState.type === 'unanswered' && (
        <div className="grid grid-cols-2 gap-3">
          {mcOptions.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleMCAnswer(opt)}
              className="py-4 px-3 rounded-xl bg-secondary text-secondary-foreground font-arabic text-xl transition-all active:scale-95 hover:bg-secondary/80"
              dir="rtl"
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Stage 2: Arabic Typing */}
      {currentStage === 2 && answerState.type === 'unanswered' && (
        <div className="space-y-3">
          <label className="text-sm text-muted-foreground font-medium">Type the Arabic word:</label>
          <input
            ref={inputRef}
            type="text"
            value={typingInput}
            onChange={(e) => setTypingInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && typingInput.trim()) handleTypingCheck();
            }}
            placeholder="اكتب الكلمة العربية"
            dir="rtl"
            className="w-full font-arabic text-[36px] bg-card border border-border rounded-xl px-4 py-3 text-foreground focus:ring-2 focus:ring-primary/30 focus:outline-none"
            style={{ fontFamily: "'Arial', 'Times New Roman', sans-serif" }}
            autoFocus
          />
          <button
            onClick={handleTypingCheck}
            disabled={!typingInput.trim()}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95 disabled:opacity-40"
          >
            Check Answer
          </button>
        </div>
      )}

      {/* Correct feedback */}
      {answerState.type === 'correct' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-success/10 border border-success/30 p-4 flex items-center gap-3">
            <Check className="w-6 h-6 text-success flex-shrink-0" />
            <div>
              <span className="font-semibold text-success">
                {currentStage === 2 ? 'Perfect!' : 'Correct!'}
              </span>
              <p className="font-arabic text-lg text-foreground mt-1" dir="rtl">{currentCard.word}</p>
            </div>
          </div>
          <button
            onClick={advanceToNext}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95"
          >
            Continue
          </button>
        </div>
      )}

      {/* Wrong feedback (Stage 1 only - auto-advances) */}
      {answerState.type === 'wrong' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-warning/10 border border-warning/30 p-4 flex items-center gap-3">
            <X className="w-6 h-6 text-warning flex-shrink-0" />
            <div>
              <span className="font-semibold text-warning">Incorrect</span>
              <p className="text-sm text-foreground mt-1">
                Correct answer: <span className="font-arabic text-lg font-semibold text-success" dir="rtl">{answerState.correctAnswer}</span>
              </p>
            </div>
          </div>
          <button
            onClick={advanceToNext}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95"
          >
            Continue
          </button>
        </div>
      )}

      {/* Manual override comparison (Stage 2) */}
      {answerState.type === 'compare' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-card border border-border p-5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">You typed:</span>
              <span className="font-arabic text-xl text-foreground" dir="rtl">{answerState.userAnswer}</span>
            </div>
            <div className="border-t border-border" />
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Correct is:</span>
              <span className="font-arabic text-xl font-semibold text-foreground" dir="rtl">{answerState.correctAnswer}</span>
            </div>
          </div>
          <p className="text-xs text-center text-muted-foreground">Press Space if close enough, Enter to retry</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleCloseEnough}
              className="py-3 rounded-xl bg-success text-success-foreground font-semibold transition-all active:scale-95"
            >
              ✓ I was close enough (Space)
            </button>
            <button
              onClick={handleTryAgain}
              className="py-3 rounded-xl bg-warning text-warning-foreground font-semibold transition-all active:scale-95"
            >
              ✗ Try again (Enter)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningMode;
