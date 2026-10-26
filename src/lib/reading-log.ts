/**
 * Chapters read through in the Library, for the reading badges. A chapter
 * counts once the learner goes on from it to the next one. Kept on the device,
 * per learner.
 */
import { currentUserId } from './progress';

const key = () => `wazn-chapters-read:${currentUserId() ?? 'anon'}`;

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key()) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function recordChapterRead(id: string): void {
  const list = read();
  if (list.includes(id)) return;
  list.push(id);
  try {
    localStorage.setItem(key(), JSON.stringify(list));
  } catch {
    /* not counted this time */
  }
}

export function chaptersRead(): number {
  return read().length;
}
