import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, Layers, List, BookText } from 'lucide-react';
import AddWords from '@/components/AddWords';
import Flashcard from '@/components/Flashcard';
import ReviewComplete from '@/components/ReviewComplete';
import DeckList from '@/components/DeckList';
import ReadingPractice from '@/components/ReadingPractice';
import { FlashCard, Rating, createCard, reviewCard, getDueCards } from '@/lib/spaced-repetition';
import { loadCards, saveCards } from '@/lib/storage';
import { searchUnsplashImage } from '@/lib/unsplash';
import { useToast } from '@/hooks/use-toast';

type View = 'home' | 'add' | 'review' | 'deck' | 'practice';

const Index = () => {
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [view, setView] = useState<View>('home');
  const [dueCards, setDueCards] = useState<FlashCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loaded = loadCards();
    setCards(loaded);
    setDueCards(getDueCards(loaded));
  }, []);

  const persist = useCallback((updated: FlashCard[]) => {
    setCards(updated);
    saveCards(updated);
  }, []);

  const handleAddWords = async (words: string[]) => {
    setIsLoading(true);
    try {
      const newCards: FlashCard[] = [];
      for (const word of words) {
        const imageUrl = await searchUnsplashImage(word);
        newCards.push(createCard(word, imageUrl));
      }
      const updated = [...cards, ...newCards];
      persist(updated);
      setDueCards(getDueCards(updated));
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
    setDueCards(due);
    setCurrentIndex(0);
    setView('review');
  };

  const handleRate = (rating: Rating) => {
    const current = dueCards[currentIndex];
    const reviewed = reviewCard(current, rating);
    const updated = cards.map((c) => (c.id === reviewed.id ? reviewed : c));
    persist(updated);
    setCurrentIndex((i) => i + 1);
  };

  const handleDelete = (id: string) => {
    const updated = cards.filter((c) => c.id !== id);
    persist(updated);
    setDueCards(getDueCards(updated));
  };

  const handleUpdateImage = (id: string, imageUrl: string) => {
    const updated = cards.map((c) => (c.id === id ? { ...c, imageUrl: imageUrl || null } : c));
    persist(updated);
  };

  const dueCount = getDueCards(cards).length;
  const reviewDone = view === 'review' && currentIndex >= dueCards.length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => setView('home')} className="flex items-center gap-2 text-foreground">
            <BookOpen className="w-5 h-5 text-primary" />
            <span className="font-bold text-lg">بطاقات</span>
          </button>
          <button
            onClick={() => setView('deck')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Layers className="w-4 h-4" />
            <span>{cards.length} words</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
        {view === 'home' && (
          <div className="space-y-8">
            <div className="rounded-2xl bg-card flashcard-shadow p-6 text-center space-y-2">
              <p className="text-4xl font-bold text-foreground">{dueCount}</p>
              <p className="text-muted-foreground">words due today</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={startReview}
                disabled={dueCount === 0}
                className="flex flex-col items-center gap-2 rounded-xl bg-primary text-primary-foreground py-5 font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                <BookOpen className="w-5 h-5" />
                Review
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
                onClick={() => setView('deck')}
                className="flex flex-col items-center gap-2 rounded-xl bg-secondary text-secondary-foreground py-5 font-semibold transition-all active:scale-95"
              >
                <List className="w-5 h-5" />
                My Deck
              </button>
            </div>
          </div>
        )}

        {view === 'add' && <AddWords onAdd={handleAddWords} isLoading={isLoading} />}

        {view === 'review' && !reviewDone && dueCards[currentIndex] && (
          <Flashcard card={dueCards[currentIndex]} onRate={handleRate} />
        )}

        {reviewDone && <ReviewComplete />}

        {view === 'deck' && (
          <DeckList
            cards={cards}
            onDelete={handleDelete}
            onUpdateImage={handleUpdateImage}
            onBack={() => setView('home')}
          />
        )}

        {view === 'practice' && (
          <ReadingPractice cards={cards} onBack={() => setView('home')} />
        )}
      </main>
    </div>
  );
};

export default Index;
