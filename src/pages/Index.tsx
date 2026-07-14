import { useState, useCallback } from 'react';
import { BookOpen, Plus, Layers, List, BookText, GraduationCap, LogOut, RefreshCw, Languages, PenTool, Wand2, Shuffle } from 'lucide-react';
import AddWords from '@/components/AddWords';
import Flashcard, { ReviewDirection } from '@/components/Flashcard';
import ReviewComplete from '@/components/ReviewComplete';
import DeckList from '@/components/DeckList';
import ReadingPractice from '@/components/ReadingPractice';
import LearningMode from '@/components/LearningMode';
import RelearnModal from '@/components/RelearnModal';
import PluralDrill from '@/components/PluralDrill';
import VerbDrill from '@/features/verbDrill';
import VerbMasdarDrill from '@/components/VerbMasdarDrill';
import { FlashCard, Rating, createCard, reviewCard, getDueCards, getLearnableCards, parseWordLine } from '@/lib/spaced-repetition';
import { useFlashcards } from '@/hooks/useFlashcards';
import { useAuth } from '@/hooks/useAuth';
import { searchUnsplashImage } from '@/lib/unsplash';
import { autoTagDeck } from '@/lib/auto-tag-deck';
import { useToast } from '@/hooks/use-toast';

type View = 'home' | 'add' | 'review' | 'deck' | 'practice' | 'learn' | 'plurals' | 'verbs' | 'verbMasdar';

const Index = () => {
  const { cards, loading, addCards, updateCard, deleteCard, refetch } = useFlashcards();
  const { signOut } = useAuth();
  const [view, setView] = useState<View>('home');
  const [reviewItems, setReviewItems] = useState<{ card: FlashCard; direction: ReviewDirection }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showRelearnModal, setShowRelearnModal] = useState(false);
  const [isTagging, setIsTagging] = useState(false);
  const { toast } = useToast();

  const handleAutoTag = async () => {
    if (isTagging) return;
    setIsTagging(true);
    toast({ title: 'Tagging deck…', description: 'Analyzing verb forms.' });
    try {
      const summary = await autoTagDeck();
      await refetch();
      toast({
        title: 'Deck tagged',
        description: `${summary.verbs} verbs · ${summary.masdars} masdars · ${summary.pairs} paired · ${summary.needsReview} need review`,
      });
    } catch (err) {
      console.error(err);
      toast({ title: 'Auto-tag failed', variant: 'destructive' });
    } finally {
      setIsTagging(false);
    }
  };

  const handleAddWords = async (lines: string[]) => {
    setIsLoading(true);
    try {
      const newCards: FlashCard[] = [];
      for (const line of lines) {
        const { arabic, english } = parseWordLine(line);
        if (!arabic) continue;
        const searchQuery = english || arabic;
        const imageUrl = await searchUnsplashImage(searchQuery);
        newCards.push(createCard(arabic, english, imageUrl));
      }
      await addCards(newCards);
      toast({
        title: `Added ${newCards.length} word${newCards.length > 1 ? 's' : ''}`,
        description: `${newCards.filter((c) => c.imageUrl).length} images found`,
      });
      setView('home');
    } catch (err) {
      console.error(err);
      toast({ title: 'Error adding words', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const startReview = () => {
    const due = getDueCards(cards);
    const items: { card: FlashCard; direction: ReviewDirection }[] = [];
    for (const card of due) {
      items.push({ card, direction: 'ar-to-en' });
      items.push({ card, direction: 'en-to-ar' });
    }
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    setReviewItems(items);
    setCurrentIndex(0);
    setView('review');
  };

  const handleRate = async (rating: Rating) => {
    const current = reviewItems[currentIndex].card;
    const reviewed = reviewCard(current, rating);
    await updateCard(reviewed.id, {
      intervalDays: reviewed.intervalDays,
      easeFactor: reviewed.easeFactor,
      nextReviewDate: reviewed.nextReviewDate,
    });
    setCurrentIndex((i) => i + 1);
  };

  const handleDelete = async (id: string) => {
    await deleteCard(id);
  };

  const handleUpdateCard = async (id: string, updates: Partial<FlashCard>) => {
    await updateCard(id, updates);
  };

  const handleStartRelearn = async (cardIds: string[]) => {
    const today = new Date().toISOString().split('T')[0];
    for (const id of cardIds) {
      await updateCard(id, {
        easeFactor: 2.5,
        intervalDays: 0,
        learningStage: 'new',
        stage1Attempts: 0,
        stage2Attempts: 0,
        nextReviewDate: today,
      });
    }
    setShowRelearnModal(false);
    toast({ title: `Reset ${cardIds.length} card${cardIds.length !== 1 ? 's' : ''} for relearning` });
    setView('learn');
  };

  const dueCount = getDueCards(cards).length;
  const learnCount = getLearnableCards(cards).length;
  const reviewDone = view === 'review' && currentIndex >= reviewItems.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Loading your flashcards...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => setView('home')} className="flex items-center gap-2 text-foreground">
            <BookOpen className="w-5 h-5 text-primary" />
            <span className="font-bold text-lg">بطاقات</span>
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('deck')}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Layers className="w-4 h-4" />
              <span>{cards.length} words</span>
            </button>
            <button
              onClick={signOut}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
        {view === 'home' && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-card flashcard-shadow p-5 text-center space-y-1">
                <p className="text-3xl font-bold text-foreground">{learnCount}</p>
                <p className="text-sm text-muted-foreground">words to learn</p>
              </div>
              <div className="rounded-2xl bg-card flashcard-shadow p-5 text-center space-y-1">
                <p className="text-3xl font-bold text-foreground">{dueCount}</p>
                <p className="text-sm text-muted-foreground">words to review</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setView('learn')}
                disabled={learnCount === 0}
                className="flex flex-col items-center gap-2 rounded-xl bg-success text-success-foreground py-5 font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                <GraduationCap className="w-5 h-5" />
                Learn New Words
              </button>
              <button
                onClick={startReview}
                disabled={dueCount === 0}
                className="flex flex-col items-center gap-2 rounded-xl bg-primary text-primary-foreground py-5 font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                <BookOpen className="w-5 h-5" />
                Review Cards
              </button>
              <button
                onClick={() => setView('add')}
                className="flex flex-col items-center gap-2 rounded-xl bg-secondary text-secondary-foreground py-5 font-semibold transition-all active:scale-95"
              >
                <Plus className="w-5 h-5" />
                Add Words
              </button>
              <button
                onClick={() => setView('practice')}
                className="flex flex-col items-center gap-2 rounded-xl bg-accent text-accent-foreground py-5 font-semibold transition-all active:scale-95"
              >
                <BookText className="w-5 h-5" />
                Practice
              </button>
              <button
                onClick={() => setShowRelearnModal(true)}
                disabled={cards.length === 0}
                className="flex flex-col items-center gap-2 rounded-xl bg-accent text-accent-foreground py-5 font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                <RefreshCw className="w-5 h-5" />
                Relearn Cards
              </button>
              <button
                onClick={() => setView('deck')}
                className="flex flex-col items-center gap-2 rounded-xl bg-secondary text-secondary-foreground py-5 font-semibold transition-all active:scale-95"
              >
                <List className="w-5 h-5" />
                My Deck
              </button>
              <button
                onClick={() => setView('plurals')}
                className="flex flex-col items-center gap-2 rounded-xl bg-primary text-primary-foreground py-5 font-semibold transition-all active:scale-95"
              >
                <Languages className="w-5 h-5" />
                Drill Plurals
              </button>
              <button
                onClick={() => setView('verbs')}
                className="flex flex-col items-center gap-2 rounded-xl bg-primary text-primary-foreground py-5 font-semibold transition-all active:scale-95"
              >
                <PenTool className="w-5 h-5" />
                Drill Verbs
              </button>
              <button
                onClick={handleAutoTag}
                disabled={cards.length === 0 || isTagging}
                className="flex flex-col items-center gap-2 rounded-xl bg-accent text-accent-foreground py-5 font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none col-span-2"
              >
                <Wand2 className="w-5 h-5" />
                {isTagging ? 'Tagging…' : 'Auto-Tag Verb Forms'}
              </button>
            </div>
          </div>
        )}

        {view === 'add' && <AddWords onAdd={handleAddWords} isLoading={isLoading} />}

        {view === 'review' && !reviewDone && reviewItems[currentIndex] && (
          <Flashcard
            card={reviewItems[currentIndex].card}
            direction={reviewItems[currentIndex].direction}
            onRate={handleRate}
          />
        )}

        {reviewDone && <ReviewComplete />}

        {view === 'learn' && (
          <LearningMode
            cards={getLearnableCards(cards)}
            allCards={cards}
            onUpdateCard={(id, updates) => handleUpdateCard(id, updates)}
            onBack={() => setView('home')}
          />
        )}

        {view === 'deck' && (
          <DeckList
            cards={cards}
            onDelete={handleDelete}
            onUpdateCard={handleUpdateCard}
            onBack={() => setView('home')}
          />
        )}

        {view === 'practice' && (
          <ReadingPractice cards={cards} onBack={() => setView('home')} />
        )}

        {view === 'plurals' && (
          <PluralDrill onBack={() => setView('home')} />
        )}

        {view === 'verbs' && (
          <VerbDrill onBack={() => setView('home')} />
        )}
      </main>

      {showRelearnModal && (
        <RelearnModal
          cards={cards}
          onClose={() => setShowRelearnModal(false)}
          onStartRelearn={handleStartRelearn}
        />
      )}
    </div>
  );
};

export default Index;
