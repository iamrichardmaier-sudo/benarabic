import { useState, useMemo, useCallback } from 'react';
import { FlashCard, graduateCard } from '@/lib/spaced-repetition';
import { checkAnswer, MatchResult } from '@/lib/fuzzy-match';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Check, X, Sparkles } from 'lucide-react';

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
  | { type: 'close'; userAnswer: string; correctAnswer: string };

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const LearningMode = ({ cards, allCards, onUpdateCard, onBack }: LearningModeProps) => {
  // Separate cards into stages
  const stage1Cards = useMemo(() => cards.filter((c) => c.learningStage === 'new' || c.learningStage === 'stage1'), [cards]);
  const stage2Cards = useMemo(() => cards.filter((c) => c.learningStage === 'stage2'), [cards]);

  const [currentStage, setCurrentStage] = useState<1 | 2>(stage1Cards.length > 0 ? 1 : 2);
  const [queue, setQueue] = useState<FlashCard[]>(() => shuffleArray(stage1Cards.length > 0 ? stage1Cards : stage2Cards));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerState, setAnswerState] = useState<AnswerState>({ type: 'unanswered' });
  const [typingInput, setTypingInput] = useState('');
  const [completedStage1, setCompletedStage1] = useState(0);
  const [completedStage2, setCompletedStage2] = useState(0);

  const currentCard = queue[currentIndex];
  const totalLearnable = cards.length;
  const isComplete = !currentCard && queue.length === 0 || (!currentCard && currentIndex >= queue.length);
  const allDone = isComplete && (currentStage === 2 || stage2Cards.length === 0);

  // Generate multiple choice options for stage 1
  const mcOptions = useMemo(() => {
    if (!currentCard || currentStage !== 1) return [];
    const correct = currentCard.english || '';
    // Get distractors from all cards with english translations
    const others = allCards
      .filter((c) => c.id !== currentCard.id && c.english)
      .map((c) => c.english!);
    const shuffledOthers = shuffleArray(others).slice(0, 3);
    // Pad with generic words if not enough distractors
    const fallbacks = ['water', 'house', 'tree', 'sun', 'road', 'bird'];
    while (shuffledOthers.length < 3) {
      const fb = fallbacks.shift();
      if (fb && fb !== correct) shuffledOthers.push(fb);
      else if (!fb) break;
    }
    return shuffleArray([correct, ...shuffledOthers]);
  }, [currentCard, currentStage, allCards]);

  const advanceToNext = useCallback(() => {
    setAnswerState({ type: 'unanswered' });
    setTypingInput('');
    if (currentIndex + 1 < queue.length) {
      setCurrentIndex((i) => i + 1);
    } else if (currentStage === 1) {
      // Move to stage 2
      // Refresh stage 2 cards (cards that are now in stage2)
      const newStage2 = cards.filter((c) => c.learningStage === 'stage2');
      if (newStage2.length > 0) {
        setCurrentStage(2);
        setQueue(shuffleArray(newStage2));
        setCurrentIndex(0);
      }
      // else allDone will be true
    }
    // If stage 2 and no more cards, allDone will be true
  }, [currentIndex, queue.length, currentStage, cards]);

  const handleMCAnswer = (selected: string) => {
    const correct = currentCard.english || '';
    const isCorrect = selected.toLowerCase() === correct.toLowerCase();
    onUpdateCard(currentCard.id, {
      stage1Attempts: currentCard.stage1Attempts + 1,
      ...(isCorrect
        ? { learningStage: 'stage2' as const }
        : { learningStage: 'stage1' as const }),
    });
    if (isCorrect) {
      setCompletedStage1((n) => n + 1);
      setAnswerState({ type: 'correct' });
    } else {
      setAnswerState({ type: 'wrong', correctAnswer: correct });
      // Re-add card to end of queue
      setQueue((q) => [...q, currentCard]);
    }
  };

  const handleTypingCheck = () => {
    const correct = currentCard.english || '';
    const result: MatchResult = checkAnswer(typingInput, correct);
    onUpdateCard(currentCard.id, { stage2Attempts: currentCard.stage2Attempts + 1 });

    if (result === 'exact') {
      const graduated = graduateCard(currentCard);
      onUpdateCard(currentCard.id, {
        learningStage: graduated.learningStage,
        nextReviewDate: graduated.nextReviewDate,
        intervalDays: graduated.intervalDays,
        easeFactor: graduated.easeFactor,
      });
      setCompletedStage2((n) => n + 1);
      setAnswerState({ type: 'correct' });
    } else if (result === 'close') {
      setAnswerState({ type: 'close', userAnswer: typingInput, correctAnswer: correct });
    } else {
      setAnswerState({ type: 'wrong', correctAnswer: correct });
      setQueue((q) => [...q, currentCard]);
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
    if (currentIndex + 1 < queue.length) {
      setCurrentIndex((i) => i + 1);
    } else {
      // This card was re-added, advance
      setCurrentIndex((i) => i + 1);
    }
  };

  // Completion screen
  if (allDone || (!currentCard && currentStage === 2)) {
    return (
      <div className="w-full max-w-md mx-auto space-y-6 text-center">
        <div className="rounded-2xl bg-card flashcard-shadow p-8 space-y-4">
          <Sparkles className="w-12 h-12 text-success mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Great job!</h2>
          <p className="text-muted-foreground">
            These words will appear in tomorrow's review.
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

  // Transition from stage 1 complete to stage 2
  if (!currentCard && currentStage === 1) {
    const newStage2 = cards.filter((c) => c.learningStage === 'stage2');
    if (newStage2.length > 0) {
      // Auto-transition
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

  const stageLabel = currentStage === 1 ? 'Stage 1: Multiple Choice' : 'Stage 2: Typing Practice';
  const completed = currentStage === 1 ? completedStage1 : completedStage2;
  const stageTotal = currentStage === 1 ? stage1Cards.length : totalLearnable;
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
      </div>

      {/* Card front: Arabic word */}
      <div className="rounded-2xl bg-card flashcard-shadow border border-border/50 p-8 text-center">
        <p className="font-arabic text-[48px] font-bold text-foreground leading-relaxed" dir="rtl">
          {currentCard.word}
        </p>
      </div>

      {/* Stage 1: Multiple Choice */}
      {currentStage === 1 && answerState.type === 'unanswered' && (
        <div className="grid grid-cols-2 gap-3">
          {mcOptions.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleMCAnswer(opt)}
              className="py-4 px-3 rounded-xl bg-secondary text-secondary-foreground font-medium text-sm transition-all active:scale-95 hover:bg-secondary/80"
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Stage 2: Typing */}
      {currentStage === 2 && answerState.type === 'unanswered' && (
        <div className="space-y-3">
          <label className="text-sm text-muted-foreground font-medium">Type the English word:</label>
          <input
            type="text"
            value={typingInput}
            onChange={(e) => setTypingInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && typingInput.trim()) handleTypingCheck();
            }}
            placeholder="Type your answer..."
            className="w-full text-lg bg-card border border-border rounded-xl px-4 py-3 text-foreground focus:ring-2 focus:ring-primary/30 focus:outline-none"
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
            <span className="font-semibold text-success">Correct!</span>
          </div>
          {/* Image reinforcement */}
          {currentCard.imageUrl && (
            <img
              src={currentCard.imageUrl}
              alt={currentCard.word}
              className="w-full rounded-xl object-cover aspect-video"
            />
          )}
          {!currentCard.imageUrl && currentCard.english && (
            <p className="text-center text-2xl text-muted-foreground">{currentCard.english}</p>
          )}
          <button
            onClick={advanceToNext}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95"
          >
            Continue
          </button>
        </div>
      )}

      {/* Wrong feedback */}
      {answerState.type === 'wrong' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-4 flex items-center gap-3">
            <X className="w-6 h-6 text-destructive flex-shrink-0" />
            <div>
              <span className="font-semibold text-destructive">Try again</span>
              <p className="text-sm text-foreground mt-1">
                Correct answer: <span className="font-semibold">{answerState.correctAnswer}</span>
              </p>
            </div>
          </div>
          {currentCard.imageUrl && (
            <img
              src={currentCard.imageUrl}
              alt={currentCard.word}
              className="w-full rounded-xl object-cover aspect-video"
            />
          )}
          <button
            onClick={advanceToNext}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95"
          >
            Continue
          </button>
        </div>
      )}

      {/* Close match feedback */}
      {answerState.type === 'close' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-warning/10 border border-warning/30 p-4 space-y-2">
            <p className="font-semibold text-warning">Close! Manual Check</p>
            <p className="text-sm text-foreground">
              You typed: <span className="font-semibold">{answerState.userAnswer}</span>
            </p>
            <p className="text-sm text-foreground">
              Correct answer: <span className="font-semibold">{answerState.correctAnswer}</span>
            </p>
          </div>
          {currentCard.imageUrl && (
            <img
              src={currentCard.imageUrl}
              alt={currentCard.word}
              className="w-full rounded-xl object-cover aspect-video"
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleCloseEnough}
              className="py-3 rounded-xl bg-success text-success-foreground font-semibold transition-all active:scale-95"
            >
              I was close enough ✓
            </button>
            <button
              onClick={handleTryAgain}
              className="py-3 rounded-xl bg-warning text-warning-foreground font-semibold transition-all active:scale-95"
            >
              Try again ✗
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningMode;
