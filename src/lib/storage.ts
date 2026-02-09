import { FlashCard } from './spaced-repetition';

const STORAGE_KEY = 'arabic-flashcards';

export function loadCards(): FlashCard[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveCards(cards: FlashCard[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}
