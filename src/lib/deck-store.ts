import { supabase } from '@/integrations/supabase/client';
import { placementFields, type DeckPlacement } from '@/lib/deck-placement';
import type { CompanionForm, FlashCard } from '@/lib/spaced-repetition';

/**
 * Decks: a shared list of words, taken up by a learner.
 *
 * The split that makes this work is that a word and a learner's progress on it
 * are different rows now. A deck points at words, so the same deck can be in
 * several people's Learn sections; each of them has their own flashcards. Add
 * or remove a deck and nobody else's progress moves — and neither does yours,
 * because removing a deck removes the membership, never the cards.
 */

export interface Deck {
  id: string;
  title: string;
  icon: string;
  bookPartPrefix: string | null;
  chapterRange: string | null;
  isPublic: boolean;
  isAdminDeck: boolean;
  createdBy: string | null;
  status: 'draft' | 'published';
  publishRequested: boolean;
  createdAt: string;
  /**
   * The shelf this deck is browsed under, or null for the main grid. A
   * category keeps a themed set out of the way of the chapter decks without
   * hiding it — see the shelves under the grid in LearnDecks.
   */
  category: string | null;
  /**
   * A drawn mark of its own, as an alpha-mask image painted with the theme
   * colour, for a deck whose subject none of the built-in marks covers.
   */
  iconUrl: string | null;
  /** How many words it holds, when the caller asked for counts. */
  wordCount?: number;
}

/** A word as the shared bank holds it. */
export interface Word {
  id: string;
  key: string;
  word: string;
  wordVoweled: string | null;
  english: string | null;
  root: string | null;
  wordType: string | null;
  verbForm: string | null;
  pastTense: string | null;
  presentTense: string | null;
  masdarForm: string | null;
  gender: 'm' | 'f' | null;
  fushaPlural: string | null;
  shaami: string | null;
  shaamiPlural: string | null;
  companionForms: CompanionForm[] | null;
  exampleSentence: string | null;
  exampleSentenceEn: string | null;
}

/** Fields a brand-new word arrives with, before it has an id. */
export type NewWordFields = Omit<Word, 'id' | 'key'> & { word: string };

interface DeckRow {
  id: string;
  title: string;
  icon: string;
  book_part_prefix: string | null;
  chapter_range: string | null;
  is_public: boolean;
  is_admin_deck: boolean;
  created_by: string | null;
  status: string;
  publish_requested: boolean;
  created_at: string;
  category: string | null;
  icon_url: string | null;
}

interface WordRow {
  id: string;
  key: string;
  word: string;
  word_voweled: string | null;
  english: string | null;
  root: string | null;
  word_type: string | null;
  verb_form: string | null;
  past_tense: string | null;
  present_tense: string | null;
  masdar_form: string | null;
  gender: string | null;
  fusha_plural: string | null;
  shaami: string | null;
  shaami_plural: string | null;
  companion_forms: CompanionForm[] | null;
  example_sentence: string | null;
  example_sentence_en: string | null;
}

const DECK_COLUMNS =
  'id,title,icon,book_part_prefix,chapter_range,is_public,is_admin_deck,created_by,status,publish_requested,created_at,category,icon_url';

const WORD_COLUMNS =
  'id,key,word,word_voweled,english,root,word_type,verb_form,past_tense,present_tense,masdar_form,gender,fusha_plural,shaami,shaami_plural,companion_forms,example_sentence,example_sentence_en';

function toDeck(row: DeckRow): Deck {
  return {
    id: row.id,
    title: row.title,
    icon: row.icon,
    bookPartPrefix: row.book_part_prefix,
    chapterRange: row.chapter_range,
    isPublic: row.is_public,
    isAdminDeck: row.is_admin_deck,
    createdBy: row.created_by,
    status: row.status === 'published' ? 'published' : 'draft',
    publishRequested: row.publish_requested,
    createdAt: row.created_at,
    category: row.category,
    iconUrl: row.icon_url,
  };
}

function toWord(row: WordRow): Word {
  return {
    id: row.id,
    key: row.key,
    word: row.word,
    wordVoweled: row.word_voweled,
    english: row.english,
    root: row.root,
    wordType: row.word_type,
    verbForm: row.verb_form,
    pastTense: row.past_tense,
    presentTense: row.present_tense,
    masdarForm: row.masdar_form,
    gender: (row.gender as 'm' | 'f' | null) ?? null,
    fushaPlural: row.fusha_plural,
    shaami: row.shaami,
    shaamiPlural: row.shaami_plural,
    companionForms: row.companion_forms,
    exampleSentence: row.example_sentence,
    exampleSentenceEn: row.example_sentence_en,
  };
}

/** Whether this account is the one allowed to publish decks. */
export async function isDeckAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_deck_admin');
  if (error) return false;
  return data === true;
}

/**
 * Every deck the browse list should show, with word counts.
 *
 * RLS decides what comes back: published decks for everyone, plus your own
 * drafts, plus everything if you are the admin.
 */
export async function fetchDecks(): Promise<Deck[]> {
  const { data, error } = await supabase
    .from('decks')
    .select(`${DECK_COLUMNS},deck_words(count)`)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as (DeckRow & { deck_words: { count: number }[] })[]).map(
    (row) => ({ ...toDeck(row), wordCount: row.deck_words?.[0]?.count ?? 0 }),
  );
}

/** The deck ids in this learner's Learn section, and any renames. */
export async function fetchUserDecks(): Promise<Map<string, string | null>> {
  const { data, error } = await supabase.from('user_decks').select('deck_id,custom_title');
  if (error) throw error;
  return new Map(
    ((data ?? []) as { deck_id: string; custom_title: string | null }[]).map((r) => [
      r.deck_id,
      r.custom_title,
    ]),
  );
}

/** The words of one deck, for the preview and the builder. */
export async function fetchDeckWords(deckId: string): Promise<Word[]> {
  const { data, error } = await supabase
    .from('deck_words')
    .select(`words(${WORD_COLUMNS})`)
    .eq('deck_id', deckId);
  if (error) throw error;
  return ((data ?? []) as unknown as { words: WordRow | null }[])
    .map((r) => r.words)
    .filter((w): w is WordRow => !!w)
    .map(toWord);
}

export interface ListenCard {
  arabic: string;
  english: string;
}

/**
 * A deck's words, in the shape "Listen to cards" speaks them -- only the
 * ones this learner actually holds as flashcards (a shared deck can outrun
 * what someone kept), and only the ones with an English gloss, since a card
 * with nothing to say in English has nothing to pair the Arabic with.
 */
export async function fetchListenCards(deckId: string, userId: string): Promise<ListenCard[]> {
  const words = await fetchDeckWords(deckId);
  const wordIds = words.map((w) => w.id);
  if (wordIds.length === 0) return [];

  const { data, error } = await supabase
    .from('flashcards')
    .select('word,word_voweled,english')
    .eq('user_id', userId)
    .in('word_id', wordIds);
  if (error) throw error;

  return ((data ?? []) as { word: string; word_voweled: string | null; english: string | null }[])
    .filter((r): r is typeof r & { english: string } => !!r.english)
    .map((r) => ({ arabic: r.word_voweled || r.word, english: r.english }));
}

/** Search the whole shared bank, not just what the learner already holds. */
export async function searchWords(query: string, limit = 40): Promise<Word[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from('words')
    .select(WORD_COLUMNS)
    .or(`word.ilike.%${q}%,english.ilike.%${q}%,root.ilike.%${q}%`)
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as WordRow[]).map(toWord);
}

/**
 * The flashcard rows a set of words becomes for one learner.
 *
 * Unlearned on purpose: a word arriving from a deck has not been studied, so
 * it belongs at the front of Learn rather than on a review schedule it has
 * not earned.
 */
function cardRowsFor(words: Word[], userId: string, placement: DeckPlacement) {
  const schedule = placementFields(placement);
  return words.map((w) => ({
    user_id: userId,
    word_id: w.id,
    word: w.word,
    word_voweled: w.wordVoweled ?? w.word,
    english: w.english,
    root: w.root,
    word_type: w.wordType,
    verb_form: w.verbForm,
    past_tense: w.pastTense,
    present_tense: w.presentTense,
    masdar_form: w.masdarForm,
    gender: w.gender,
    fusha_plural: w.fushaPlural,
    shaami: w.shaami,
    shaami_plural: w.shaamiPlural,
    companion_forms: w.companionForms,
    ...schedule,
    tagged_at: w.root ? new Date().toISOString() : null,
  }));
}

/**
 * Take up one or more decks.
 *
 * `placement` decides where the new cards start — queued up to be learned,
 * straight into the review rotation, or parked as mastered — and nothing else.
 * It has no effect on words already held: a card that exists keeps the
 * schedule it earned, whichever way the deck carrying it arrives.
 *
 * Words already held are skipped rather than duplicated: one flashcard per
 * word however many decks contain it, so a word in two decks is never
 * reviewed twice.
 */
export async function addDecksToLearn(
  deckIds: string[],
  userId: string,
  placement: DeckPlacement = 'learn',
): Promise<{ decks: number; newCards: number }> {
  if (deckIds.length === 0) return { decks: 0, newCards: 0 };

  const { error: linkError } = await supabase
    .from('user_decks')
    .upsert(deckIds.map((deck_id) => ({ user_id: userId, deck_id })) as never, {
      onConflict: 'user_id,deck_id',
    });
  if (linkError) throw linkError;

  const wanted = new Map<string, Word>();
  for (const deckId of deckIds) {
    for (const word of await fetchDeckWords(deckId)) wanted.set(word.id, word);
  }

  const { data: held, error: heldError } = await supabase
    .from('flashcards')
    .select('word_id')
    .not('word_id', 'is', null);
  if (heldError) throw heldError;
  const alreadyHave = new Set(((held ?? []) as { word_id: string }[]).map((r) => r.word_id));

  const missing = [...wanted.values()].filter((w) => !alreadyHave.has(w.id));
  if (missing.length > 0) {
    const { error } = await supabase
      .from('flashcards')
      .insert(cardRowsFor(missing, userId, placement) as never);
    if (error) throw error;
  }
  return { decks: deckIds.length, newCards: missing.length };
}

/**
 * Put a deck aside.
 *
 * Only the membership goes. The flashcards and their review history stay, so
 * taking the deck up again later resumes rather than restarts.
 */
export async function removeDeckFromLearn(deckId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_decks')
    .delete()
    .eq('deck_id', deckId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function createDeck(fields: {
  title: string;
  icon: string;
  createdBy: string;
  isPublic?: boolean;
  isAdminDeck?: boolean;
  status?: 'draft' | 'published';
  bookPartPrefix?: string | null;
  chapterRange?: string | null;
}): Promise<Deck> {
  const { data, error } = await supabase
    .from('decks')
    .insert({
      title: fields.title.trim() || 'Untitled deck',
      icon: fields.icon,
      created_by: fields.createdBy,
      is_public: fields.isPublic ?? false,
      is_admin_deck: fields.isAdminDeck ?? false,
      status: fields.status ?? 'draft',
      book_part_prefix: fields.bookPartPrefix ?? null,
      chapter_range: fields.chapterRange ?? null,
    } as never)
    .select(DECK_COLUMNS)
    .single();
  if (error) throw error;
  return toDeck(data as unknown as DeckRow);
}

export async function updateDeck(
  deckId: string,
  changes: Partial<{
    title: string;
    icon: string;
    status: 'draft' | 'published';
    isPublic: boolean;
    publishRequested: boolean;
  }>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (changes.title !== undefined) row.title = changes.title.trim() || 'Untitled deck';
  if (changes.icon !== undefined) row.icon = changes.icon;
  if (changes.status !== undefined) row.status = changes.status;
  if (changes.isPublic !== undefined) row.is_public = changes.isPublic;
  if (changes.publishRequested !== undefined) row.publish_requested = changes.publishRequested;
  const { error } = await supabase.from('decks').update(row as never).eq('id', deckId);
  if (error) throw error;
}

export async function deleteDeck(deckId: string): Promise<void> {
  const { error } = await supabase.from('decks').delete().eq('id', deckId);
  if (error) throw error;
}

/** Rename a deck in your own Learn section without touching the deck itself. */
export async function renameInLearn(
  deckId: string,
  userId: string,
  customTitle: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('user_decks')
    .update({ custom_title: customTitle?.trim() || null } as never)
    .eq('deck_id', deckId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function setDeckWords(deckId: string, wordIds: string[]): Promise<void> {
  if (wordIds.length === 0) return;
  const { error } = await supabase
    .from('deck_words')
    .upsert(wordIds.map((word_id) => ({ deck_id: deckId, word_id })) as never, {
      onConflict: 'deck_id,word_id',
    });
  if (error) throw error;
}

export async function removeDeckWord(deckId: string, wordId: string): Promise<void> {
  const { error } = await supabase
    .from('deck_words')
    .delete()
    .eq('deck_id', deckId)
    .eq('word_id', wordId);
  if (error) throw error;
}

/**
 * Put a word into the shared bank, or find the one already there.
 *
 * Keyed on the word with its tashkeel folded, so two spellings of one word do
 * not become two entries. An existing entry is returned rather than
 * overwritten: someone else's tagging is not this caller's to discard.
 */
export async function ensureWord(fields: NewWordFields): Promise<Word> {
  const { data: key, error: keyError } = await supabase.rpc('normalize_arabic', {
    input: fields.word,
  });
  if (keyError) throw keyError;

  const { data: existing } = await supabase
    .from('words')
    .select(WORD_COLUMNS)
    .eq('key', key as unknown as string)
    .maybeSingle();
  if (existing) return toWord(existing as unknown as WordRow);

  const { data, error } = await supabase
    .from('words')
    .insert({
      key: key as unknown as string,
      word: fields.word,
      word_voweled: fields.wordVoweled ?? fields.word,
      english: fields.english,
      root: fields.root,
      word_type: fields.wordType,
      verb_form: fields.verbForm,
      past_tense: fields.pastTense,
      present_tense: fields.presentTense,
      masdar_form: fields.masdarForm,
      gender: fields.gender,
      fusha_plural: fields.fushaPlural,
      shaami: fields.shaami,
      shaami_plural: fields.shaamiPlural,
      companion_forms: fields.companionForms,
      example_sentence: fields.exampleSentence,
      example_sentence_en: fields.exampleSentenceEn,
    } as never)
    .select(WORD_COLUMNS)
    .single();
  if (error) throw error;
  return toWord(data as unknown as WordRow);
}

/**
 * A shared word in the shape WordDetail describes.
 *
 * Not a real card and never saved as one — it lets the deck preview reuse the
 * panel the flashcard, the deck list and the reader all use, so a word reads
 * the same wherever it is met.
 */
export function wordToCard(word: Word): FlashCard {
  return {
    id: `word:${word.id}`,
    word: word.word,
    wordVoweled: word.wordVoweled ?? word.word,
    english: word.english,
    imageUrl: null,
    nextReviewDate: '',
    intervalDays: 0,
    easeFactor: 0,
    learningStage: 'new',
    stage1Attempts: 0,
    stage2Attempts: 0,
    root: word.root,
    wordType: word.wordType as FlashCard['wordType'],
    verbForm: word.verbForm as FlashCard['verbForm'],
    gender: word.gender,
    fushaPlural: word.fushaPlural,
    shaami: word.shaami,
    shaamiPlural: word.shaamiPlural,
    pastTense: word.pastTense,
    presentTense: word.presentTense,
    masdarForm: word.masdarForm,
    companionForms: word.companionForms,
  };
}

/**
 * Give one learner's card a picture.
 *
 * Used by the JSON import, whose schema has always had an imageQuery field;
 * the picture belongs on the card rather than on the shared word, since it is
 * a memory aid for one person and not a fact about the word.
 */
export async function setCardImage(
  userId: string,
  wordId: string,
  imageUrl: string,
): Promise<void> {
  const { error } = await supabase
    .from('flashcards')
    .update({ image_url: imageUrl } as never)
    .eq('user_id', userId)
    .eq('word_id', wordId)
    .is('image_url', null);
  if (error) throw error;
}

export interface DeckStat {
  deckId: string;
  title: string;
  words: number;
  learners: number;
}

/** Counts for the admin: how many words, and how many people took it up. */
export async function fetchDeckStats(): Promise<DeckStat[]> {
  const decks = await fetchDecks();
  const { data, error } = await supabase.from('user_decks').select('deck_id');
  if (error) throw error;
  const takeUp = new Map<string, number>();
  for (const row of (data ?? []) as { deck_id: string }[]) {
    takeUp.set(row.deck_id, (takeUp.get(row.deck_id) ?? 0) + 1);
  }
  return decks.map((d) => ({
    deckId: d.id,
    title: d.title,
    words: d.wordCount ?? 0,
    learners: takeUp.get(d.id) ?? 0,
  }));
}
