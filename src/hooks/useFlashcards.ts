import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FlashCard } from '@/lib/spaced-repetition';
import { loadCards } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';

interface DbRow {
  id: string;
  user_id: string;
  word: string;
  english: string | null;
  image_url: string | null;
  next_review_date: string;
  interval_days: number;
  ease_factor: number;
  learning_stage: string;
  stage1_attempts: number;
  stage2_attempts: number;
  created_at: string;
  root: string | null;
  word_type: string | null;
  verb_form: string | null;
  paired_word_id: string | null;
  needs_review: boolean;
}

function rowToCard(row: DbRow): FlashCard {
  return {
    id: row.id,
    word: row.word,
    english: row.english,
    imageUrl: row.image_url,
    nextReviewDate: row.next_review_date,
    intervalDays: row.interval_days,
    easeFactor: row.ease_factor,
    learningStage: row.learning_stage as FlashCard['learningStage'],
    stage1Attempts: row.stage1_attempts,
    stage2Attempts: row.stage2_attempts,
    root: row.root,
    wordType: row.word_type as FlashCard['wordType'],
    verbForm: row.verb_form as FlashCard['verbForm'],
    pairedWordId: row.paired_word_id,
    needsReview: row.needs_review,
  };
}

function cardToRow(card: FlashCard) {
  return {
    id: card.id,
    word: card.word,
    english: card.english,
    image_url: card.imageUrl,
    next_review_date: card.nextReviewDate,
    interval_days: card.intervalDays,
    ease_factor: card.easeFactor,
    learning_stage: card.learningStage,
    stage1_attempts: card.stage1Attempts,
    stage2_attempts: card.stage2Attempts,
  };
}

const MIGRATION_KEY = 'arabic-flashcards-migrated';

export function useFlashcards() {
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCards = useCallback(async () => {
    const { data, error } = await supabase
      .from('flashcards')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error fetching cards:', error);
      return;
    }
    setCards((data as DbRow[]).map(rowToCard));
  }, []);

  // Initial load + localStorage migration
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchCards();

      // One-time migration from localStorage
      if (!localStorage.getItem(MIGRATION_KEY)) {
        const localCards = loadCards();
        if (localCards.length > 0) {
          const rows = localCards.map(cardToRow);
          const { error } = await supabase.from('flashcards').insert(rows as any);
          if (!error) {
            toast({
              title: `Imported ${localCards.length} cards`,
              description: 'Your local flashcards have been saved to the cloud.',
            });
            await fetchCards();
          }
        }
        localStorage.setItem(MIGRATION_KEY, 'true');
      }

      setLoading(false);
    };
    init();
  }, [fetchCards, toast]);

  const addCards = useCallback(async (newCards: FlashCard[]) => {
    const rows = newCards.map(cardToRow);
    const { error } = await supabase.from('flashcards').insert(rows as any);
    if (error) {
      console.error('Error inserting cards:', error);
      throw error;
    }
    await fetchCards();
  }, [fetchCards]);

  const updateCard = useCallback(async (id: string, updates: Partial<FlashCard>) => {
    const dbUpdates: Record<string, any> = {};
    if (updates.word !== undefined) dbUpdates.word = updates.word;
    if (updates.english !== undefined) dbUpdates.english = updates.english;
    if (updates.imageUrl !== undefined) dbUpdates.image_url = updates.imageUrl;
    if (updates.nextReviewDate !== undefined) dbUpdates.next_review_date = updates.nextReviewDate;
    if (updates.intervalDays !== undefined) dbUpdates.interval_days = updates.intervalDays;
    if (updates.easeFactor !== undefined) dbUpdates.ease_factor = updates.easeFactor;
    if (updates.learningStage !== undefined) dbUpdates.learning_stage = updates.learningStage;
    if (updates.stage1Attempts !== undefined) dbUpdates.stage1_attempts = updates.stage1Attempts;
    if (updates.stage2Attempts !== undefined) dbUpdates.stage2_attempts = updates.stage2Attempts;

    const { error } = await supabase.from('flashcards').update(dbUpdates).eq('id', id);
    if (error) {
      console.error('Error updating card:', error);
      return;
    }
    // Optimistic local update
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }, []);

  const deleteCard = useCallback(async (id: string) => {
    const { error } = await supabase.from('flashcards').delete().eq('id', id);
    if (error) {
      console.error('Error deleting card:', error);
      return;
    }
    setCards((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { cards, loading, addCards, updateCard, deleteCard, refetch: fetchCards };
}
