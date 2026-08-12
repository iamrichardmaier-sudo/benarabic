import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FlashCard, CompanionForm } from '@/lib/spaced-repetition';
import { loadCards } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { isOnline, useOnlineStatus } from '@/hooks/useOnlineStatus';
import {
  cacheDeck,
  isNetworkError,
  queueMutation,
  readCachedDeck,
  readQueue,
  writeQueue,
  type PendingMutation,
} from '@/lib/offline-cache';

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
  shaami: string | null;
  fusha_plural: string | null;
  shaami_plural: string | null;
  word_voweled: string | null;
  past_tense: string | null;
  present_tense: string | null;
  masdar_form: string | null;
  companion_forms: CompanionForm[] | null;
  tagged_at: string | null;
  card_group: string | null;
  fixed_preposition: string | null;
  preposition_sentence: string | null;
  preposition_sentence_en: string | null;
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
    shaami: row.shaami,
    fushaPlural: row.fusha_plural,
    shaamiPlural: row.shaami_plural,
    wordVoweled: row.word_voweled,
    pastTense: row.past_tense,
    presentTense: row.present_tense,
    masdarForm: row.masdar_form,
    companionForms: row.companion_forms,
    taggedAt: row.tagged_at,
    group: row.card_group,
    fixedPreposition: row.fixed_preposition,
    prepositionSentence: row.preposition_sentence,
    prepositionSentenceEn: row.preposition_sentence_en,
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
    shaami: card.shaami ?? null,
    fusha_plural: card.fushaPlural ?? null,
    shaami_plural: card.shaamiPlural ?? null,
    root: card.root ?? null,
    word_type: card.wordType ?? null,
    verb_form: card.verbForm ?? null,
    word_voweled: card.wordVoweled ?? null,
    past_tense: card.pastTense ?? null,
    present_tense: card.presentTense ?? null,
    masdar_form: card.masdarForm ?? null,
    companion_forms: card.companionForms ?? null,
    tagged_at: card.taggedAt ?? null,
    card_group: card.group ?? null,
    fixed_preposition: card.fixedPreposition ?? null,
    preposition_sentence: card.prepositionSentence ?? null,
    preposition_sentence_en: card.prepositionSentenceEn ?? null,
  };
}

function toDbUpdates(updates: Partial<FlashCard>): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (updates.word !== undefined) db.word = updates.word;
  if (updates.english !== undefined) db.english = updates.english;
  if (updates.imageUrl !== undefined) db.image_url = updates.imageUrl;
  if (updates.nextReviewDate !== undefined) db.next_review_date = updates.nextReviewDate;
  if (updates.intervalDays !== undefined) db.interval_days = updates.intervalDays;
  if (updates.easeFactor !== undefined) db.ease_factor = updates.easeFactor;
  if (updates.learningStage !== undefined) db.learning_stage = updates.learningStage;
  if (updates.stage1Attempts !== undefined) db.stage1_attempts = updates.stage1Attempts;
  if (updates.stage2Attempts !== undefined) db.stage2_attempts = updates.stage2Attempts;
  if (updates.root !== undefined) db.root = updates.root;
  if (updates.wordType !== undefined) db.word_type = updates.wordType;
  if (updates.verbForm !== undefined) db.verb_form = updates.verbForm;
  if (updates.pairedWordId !== undefined) db.paired_word_id = updates.pairedWordId;
  if (updates.needsReview !== undefined) db.needs_review = updates.needsReview;
  if (updates.shaami !== undefined) db.shaami = updates.shaami;
  if (updates.fushaPlural !== undefined) db.fusha_plural = updates.fushaPlural;
  if (updates.shaamiPlural !== undefined) db.shaami_plural = updates.shaamiPlural;
  if (updates.wordVoweled !== undefined) db.word_voweled = updates.wordVoweled;
  if (updates.pastTense !== undefined) db.past_tense = updates.pastTense;
  if (updates.presentTense !== undefined) db.present_tense = updates.presentTense;
  if (updates.masdarForm !== undefined) db.masdar_form = updates.masdarForm;
  if (updates.companionForms !== undefined) db.companion_forms = updates.companionForms;
  if (updates.taggedAt !== undefined) db.tagged_at = updates.taggedAt;
  if (updates.group !== undefined) db.card_group = updates.group;
  if (updates.fixedPreposition !== undefined) db.fixed_preposition = updates.fixedPreposition;
  if (updates.prepositionSentence !== undefined) db.preposition_sentence = updates.prepositionSentence;
  if (updates.prepositionSentenceEn !== undefined) db.preposition_sentence_en = updates.prepositionSentenceEn;
  return db;
}

/** Replays one queued write. Returns the error, or null on success. */
async function sendMutation(mutation: PendingMutation): Promise<unknown> {
  if (mutation.kind === 'upsert') {
    // Upsert rather than insert: replay must be safe if an earlier attempt
    // partially succeeded before the connection dropped.
    const rows = mutation.cards.map(cardToRow);
    const { error } = await supabase.from('flashcards').upsert(rows as never);
    return error;
  }
  if (mutation.kind === 'update') {
    const { error } = await supabase
      .from('flashcards')
      .update(toDbUpdates(mutation.updates) as never)
      .eq('id', mutation.id);
    return error;
  }
  const { error } = await supabase.from('flashcards').delete().eq('id', mutation.id);
  return error;
}

const MIGRATION_KEY = 'arabic-flashcards-migrated';

export function useFlashcards() {
  const { user, loading: authLoading } = useAuth();
  const scope = user?.id;
  const online = useOnlineStatus();
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const { toast } = useToast();
  const migrationRan = useRef(false);
  const syncing = useRef(false);

  // Show the cached deck the moment we know whose deck it is, so a cold start
  // with no network still lands on a usable app.
  useEffect(() => {
    if (!scope) return;
    setCards(readCachedDeck(scope));
    setPendingCount(readQueue(scope).length);
  }, [scope]);

  const applyCards = useCallback(
    (updater: FlashCard[] | ((prev: FlashCard[]) => FlashCard[])) => {
      setCards((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (scope) cacheDeck(scope, next);
        return next;
      });
    },
    [scope],
  );

  const fetchCards = useCallback(async () => {
    if (!isOnline()) return false;
    const { data, error } = await supabase
      .from('flashcards')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error fetching cards:', error);
      return false;
    }
    applyCards((data as unknown as DbRow[]).map(rowToCard));
    return true;
  }, [applyCards]);

  /** Drains queued writes oldest-first. Returns false if the network died again. */
  const flushQueue = useCallback(async (): Promise<boolean> => {
    if (!scope) return false;
    let queue = readQueue(scope);
    while (queue.length > 0) {
      const error = await sendMutation(queue[0]);
      if (error) {
        if (isNetworkError(error)) {
          setPendingCount(queue.length);
          return false;
        }
        // The server rejected it outright — retrying forever would wedge the
        // queue, so drop it loudly and keep the rest moving.
        console.error('Dropping write the server rejected:', queue[0], error);
      }
      queue = queue.slice(1);
      writeQueue(scope, queue);
    }
    setPendingCount(0);
    return true;
  }, [scope]);

  const sync = useCallback(async () => {
    if (!scope || syncing.current || !isOnline()) return;
    syncing.current = true;
    try {
      // Push local work before pulling, otherwise the server copy would
      // overwrite edits that never made it up.
      const drained = await flushQueue();
      if (drained) await fetchCards();
    } finally {
      syncing.current = false;
    }
  }, [scope, flushQueue, fetchCards]);

  const runMigration = useCallback(async () => {
    if (migrationRan.current || localStorage.getItem(MIGRATION_KEY)) return;
    migrationRan.current = true;
    const localCards = loadCards();
    if (localCards.length > 0) {
      const { error } = await supabase.from('flashcards').insert(localCards.map(cardToRow) as never);
      if (error) {
        migrationRan.current = false; // try again in a later online session
        return;
      }
      toast({
        title: `Imported ${localCards.length} cards`,
        description: 'Your local flashcards have been saved to the cloud.',
      });
    }
    localStorage.setItem(MIGRATION_KEY, 'true');
  }, [toast]);

  // Initial load, and a full resync every time connectivity returns.
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    const run = async () => {
      if (!scope || !online) {
        setLoading(false);
        return;
      }
      await runMigration();
      if (!cancelled) await sync();
      if (!cancelled) setLoading(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [authLoading, scope, online, sync, runMigration]);

  const addCards = useCallback(
    async (newCards: FlashCard[]) => {
      applyCards((prev) => [...prev, ...newCards]);
      if (isOnline()) {
        const { error } = await supabase.from('flashcards').upsert(newCards.map(cardToRow) as never);
        if (!error) {
          await fetchCards();
          return;
        }
        // A rejection the server explained is a real bug — let the UI show it.
        if (!isNetworkError(error)) throw error;
      }
      setPendingCount(queueMutation(scope, { kind: 'upsert', cards: newCards }));
    },
    [applyCards, scope, fetchCards],
  );

  const updateCard = useCallback(
    async (id: string, updates: Partial<FlashCard>) => {
      applyCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
      if (isOnline()) {
        const { error } = await supabase
          .from('flashcards')
          .update(toDbUpdates(updates) as never)
          .eq('id', id);
        if (!error) return;
        if (!isNetworkError(error)) {
          console.error('Error updating card:', error);
          return;
        }
      }
      setPendingCount(queueMutation(scope, { kind: 'update', id, updates }));
    },
    [applyCards, scope],
  );

  const deleteCard = useCallback(
    async (id: string) => {
      applyCards((prev) => prev.filter((c) => c.id !== id));
      if (isOnline()) {
        const { error } = await supabase.from('flashcards').delete().eq('id', id);
        if (!error) return;
        if (!isNetworkError(error)) {
          console.error('Error deleting card:', error);
          return;
        }
      }
      setPendingCount(queueMutation(scope, { kind: 'delete', id }));
    },
    [applyCards, scope],
  );

  return {
    cards,
    loading,
    addCards,
    updateCard,
    deleteCard,
    refetch: fetchCards,
    online,
    pendingCount,
    syncNow: sync,
  };
}
