/**
 * Badges for real milestones: words learned, streaks, whole root families,
 * every verb form, chapters read, the top level. Each is worked out from data
 * the app already has; once earned, a badge is kept (with the date) even if
 * the number behind it later drops, e.g. a card reset for relearning.
 */
import type { FlashCard, VerbForm } from './spaced-repetition';
import { currentUserId } from './progress';

export interface BadgeContext {
  cards: FlashCard[];
  longestStreak: number;
  chaptersRead: number;
  level: number;
}

export type BadgeIcon = 'words' | 'streak' | 'root' | 'forms' | 'reading' | 'crown';

export interface BadgeDef {
  id: string;
  name: string;
  arabic: string;
  description: string;
  icon: BadgeIcon;
  /** How far along, and the target. */
  progress: (c: BadgeContext) => { value: number; goal: number };
}

const learned = (cards: FlashCard[]) => cards.filter((c) => c.learningStage === 'graduated');

/** Roots with at least three words in the deck, every one of them learned. */
export function completeRootFamilies(cards: FlashCard[]): string[] {
  const byRoot = new Map<string, FlashCard[]>();
  for (const c of cards) {
    const r = c.root?.trim();
    if (!r) continue;
    byRoot.set(r, [...(byRoot.get(r) ?? []), c]);
  }
  return [...byRoot]
    .filter(([, list]) => list.length >= 3 && list.every((c) => c.learningStage === 'graduated'))
    .map(([r]) => r);
}

const FORMS: VerbForm[] = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export function learnedForms(cards: FlashCard[]): VerbForm[] {
  const have = new Set(learned(cards).filter((c) => c.wordType === 'verb').map((c) => c.verbForm));
  return FORMS.filter((f) => have.has(f));
}

const words = (n: number) => (c: BadgeContext) => ({ value: learned(c.cards).length, goal: n });
const streak = (n: number) => (c: BadgeContext) => ({ value: c.longestStreak, goal: n });
const chapters = (n: number) => (c: BadgeContext) => ({ value: c.chaptersRead, goal: n });

export const BADGES: BadgeDef[] = [
  { id: 'words-10', name: 'First Ten', arabic: 'عَشْرُ كَلِمَات', description: 'Learn 10 words.', icon: 'words', progress: words(10) },
  { id: 'words-100', name: 'A Hundred Words', arabic: 'مِئَةُ كَلِمَة', description: 'Learn 100 words.', icon: 'words', progress: words(100) },
  { id: 'words-500', name: 'Five Hundred Words', arabic: 'خَمْسُمِئَةِ كَلِمَة', description: 'Learn 500 words.', icon: 'words', progress: words(500) },
  { id: 'words-1000', name: 'A Thousand Words', arabic: 'أَلْفُ كَلِمَة', description: 'Learn 1,000 words.', icon: 'words', progress: words(1000) },
  { id: 'streak-7', name: 'A Week Running', arabic: 'أُسْبُوع', description: 'Study 7 days in a row.', icon: 'streak', progress: streak(7) },
  { id: 'streak-30', name: 'A Month Running', arabic: 'شَهْر', description: 'Study 30 days in a row.', icon: 'streak', progress: streak(30) },
  { id: 'streak-100', name: 'A Hundred Days', arabic: 'مِئَةُ يَوْم', description: 'Study 100 days in a row.', icon: 'streak', progress: streak(100) },
  {
    id: 'root-family', name: 'Root Family', arabic: 'أُسْرَةُ الجَذْر', icon: 'root',
    description: 'Learn every word in your deck from one root (at least three).',
    progress: (c) => ({ value: Math.min(completeRootFamilies(c.cards).length, 1), goal: 1 }),
  },
  {
    id: 'roots-10', name: 'Ten Families', arabic: 'عَشْرُ أُسَر', icon: 'root',
    description: 'Complete ten root families.',
    progress: (c) => ({ value: completeRootFamilies(c.cards).length, goal: 10 }),
  },
  {
    id: 'forms-10', name: 'All Ten Forms', arabic: 'الأَوْزَانُ العَشَرَة', icon: 'forms',
    description: 'Learn a verb in each of the ten verb forms, I to X.',
    progress: (c) => ({ value: learnedForms(c.cards).length, goal: 10 }),
  },
  { id: 'chapter-1', name: 'First Chapter', arabic: 'الفَصْلُ الأَوَّل', description: 'Read a whole chapter in the Library and go on to the next.', icon: 'reading', progress: chapters(1) },
  { id: 'chapters-10', name: 'Ten Chapters', arabic: 'عَشَرَةُ فُصُول', description: 'Read ten chapters in the Library.', icon: 'reading', progress: chapters(10) },
  { id: 'level-15', name: 'The Summit', arabic: 'القِمَّة', description: 'Reach level 15.', icon: 'crown', progress: (c) => ({ value: c.level, goal: 15 }) },
];

const key = () => `wazn-badges:${currentUserId() ?? 'anon'}`;

/** Earned badge ids and the day each was earned. */
export function earnedBadges(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(key()) || 'null');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

/**
 * Records any badge newly reached and returns those. The very first check on
 * a device records what is already earned without returning it, so an
 * existing learner is not greeted by a pile of badges at once.
 */
export function checkBadges(ctx: BadgeContext): BadgeDef[] {
  let first = false;
  try {
    first = localStorage.getItem(key()) === null;
  } catch {
    return [];
  }
  const earned = earnedBadges();
  const fresh: BadgeDef[] = [];
  const day = new Date().toISOString().slice(0, 10);
  for (const b of BADGES) {
    if (earned[b.id]) continue;
    const p = b.progress(ctx);
    if (p.value >= p.goal) {
      earned[b.id] = day;
      fresh.push(b);
    }
  }
  if (fresh.length || first) {
    try {
      localStorage.setItem(key(), JSON.stringify(earned));
    } catch {
      /* try again next time */
    }
  }
  return first ? [] : fresh;
}
