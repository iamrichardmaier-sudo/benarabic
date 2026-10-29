import { useMemo } from 'react';
import { normalizeArabic } from './arabic-normalize';
import type { FlashCard, WordType } from './spaced-repetition';
import type { NewWord } from '@/contexts/DeckActionsContext';
import { POS_LABEL, type DictEntry } from './ref-dictionary';

/** How the reference dictionary meets the deck: what is held, and what a new card carries. */

/** Normalized spellings of every word in the deck, to mark what is already held. */
export function useDeckKeys(deck: FlashCard[]): Set<string> {
  return useMemo(() => {
    const keys = new Set<string>();
    for (const c of deck) {
      for (const w of [c.word, c.wordVoweled]) if (w) keys.add(normalizeArabic(w));
    }
    return keys;
  }, [deck]);
}

/** "Noun · masculine", "Verb · Form II". */
export function posLine(x: { pos: string; form?: string; gender?: string }): string {
  return [
    POS_LABEL[x.pos] ?? x.pos,
    x.form ? `Form ${x.form}` : '',
    x.gender === 'm' ? 'masculine' : x.gender === 'f' ? 'feminine' : '',
  ].filter(Boolean).join(' · ');
}

function wordTypeOf(e: DictEntry): WordType {
  if (e.pos === 'verb') return 'verb';
  if (e.pos === 'adj') return 'adjective';
  if (e.pos === 'noun') return e.masdarOf?.length ? 'masdar' : 'noun';
  return 'other';
}

/** A dictionary entry as a new card, carrying everything a card has a field for. */
export function toNewWord(e: DictEntry, gloss: string): NewWord {
  return {
    word: e.w,
    wordVoweled: e.w,
    english: gloss || null,
    root: e.root ?? null,
    wordType: wordTypeOf(e),
    verbForm: e.form ?? null,
    fushaPlural: e.pl?.[0] ?? null,
    pastTense: e.pos === 'verb' ? e.w : null,
    presentTense: e.present?.[0] ?? null,
    masdarForm: e.masdar?.[0] ?? null,
  };
}

