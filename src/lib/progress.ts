/**
 * The learner's XP, chosen background and chosen flashcard script, shared by
 * every screen and by the iOS widget, which reads the same row.
 *
 * XP shows the moment it is earned and is sent to the database in batches
 * (add_xp in supabase/migrations/..._add_user_progress.sql). Until a batch is
 * confirmed it waits on this device, so XP earned offline, or before that
 * migration has been deployed, is kept and sent later rather than lost.
 */
import { supabase } from '@/integrations/supabase/client';
import { levelFor } from './levels';
import { readPreferences, setCardFont as setLocalCardFont } from './preferences';
import { today } from './streak';

export interface ProgressSnapshot {
  /** XP the database has confirmed plus XP still waiting to be sent. */
  xp: number;
  background: string | null;
  loaded: boolean;
  /** XP per local calendar day (yyyy-mm-dd), all devices and the widget, pending included. */
  days: Readonly<Record<string, number>>;
}

// The generated Supabase types predate these tables; this is the slice used here.
type DbError = { code?: string; message?: string } | null;
type LooseClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: DbError }>;
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, v: string) => {
        maybeSingle: () => Promise<{ data: { xp: number; background: string | null; card_font?: string | null } | null; error: DbError }>;
        gte: (col: string, v: string) => Promise<{ data: { day: string; xp: number }[] | null; error: DbError }>;
      };
    };
  };
};
const db = supabase as unknown as LooseClient;

const BATCH_MAX = 2000; // add_xp clamps a single call at this
const FLUSH_DELAY = 1500;

let userId: string | null = null;
let serverXp = 0;
/** XP not yet confirmed by the database, by the local day it was earned on. */
let pending: Record<string, number> = {};
/** XP per day as the database last reported it. */
let serverDays: Record<string, number> = {};
let background: string | null = null;
let loaded = false;
let flushing = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let snapshot: ProgressSnapshot = { xp: 0, background: null, loaded: false, days: {} };
const listeners = new Set<() => void>();

const key = (name: string) => `wazn-${name}:${userId ?? 'anon'}`;

function readNum(name: string): number {
  try {
    const n = Number(localStorage.getItem(key(name)));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeLocal(name: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key(name));
    else localStorage.setItem(key(name), value);
  } catch {
    /* storage full or blocked: the in-memory value still holds for now */
  }
}

function readJson(name: string): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(key(name)) || '{}');
    const out: Record<string, number> = {};
    if (v && typeof v === 'object') {
      for (const [d, n] of Object.entries(v)) if (/^\d{4}-\d{2}-\d{2}$/.test(d) && Number(n) > 0) out[d] = Number(n);
    }
    return out;
  } catch {
    return {};
  }
}

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

function emit() {
  const days: Record<string, number> = { ...serverDays };
  for (const [d, n] of Object.entries(pending)) days[d] = (days[d] ?? 0) + n;
  snapshot = { xp: serverXp + sum(pending), background, loaded, days };
  for (const l of listeners) l();
}

/** Days kept: enough for streaks and the freezes walk, small enough for storage. */
const KEEP_DAYS = 400;

function persist() {
  writeLocal('xp-pending-days', sum(pending) > 0 ? JSON.stringify(pending) : null);
  writeLocal('xp-confirmed', String(serverXp));
  writeLocal('xp-days', JSON.stringify(serverDays));
  writeLocal('background', background);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return today(d);
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): ProgressSnapshot {
  return snapshot;
}

/** Start (or switch to) a learner. Shows the last known totals at once, then refreshes. */
export async function loadProgress(id: string | null): Promise<void> {
  if (id === userId && loaded) return;
  userId = id;
  serverXp = readNum('xp-confirmed');
  pending = readJson('xp-pending-days');
  serverDays = readJson('xp-days');
  // XP queued by the first version, before it was kept per day.
  const legacy = readNum('xp-pending');
  if (legacy > 0) {
    pending[today()] = (pending[today()] ?? 0) + legacy;
    writeLocal('xp-pending', null);
  }
  try {
    background = localStorage.getItem(key('background'));
  } catch {
    background = null;
  }
  loaded = false;
  emit();
  if (!id) return;
  try {
    let res = await db.from('user_progress').select('xp, background, card_font').eq('user_id', id).maybeSingle();
    // Before the card_font migration is deployed the column does not exist;
    // that must not cost the XP read.
    if (res.error) res = await db.from('user_progress').select('xp, background').eq('user_id', id).maybeSingle();
    const { data, error } = res;
    if (id !== userId) return;
    if (!error) {
      serverXp = data?.xp ?? 0;
      // A choice made on this device while offline wins over the stored one.
      if (data?.background !== undefined && !localStorage.getItem(key('background-dirty'))) {
        background = data?.background ?? null;
      }
      // The script chosen on another device, or in the widget, follows the
      // account here. Same rule: an unsent choice made on this device wins.
      const font = data?.card_font;
      if (localStorage.getItem(key('card-font-dirty'))) void setCardFont(readPreferences().cardFont);
      else if (font && font !== readPreferences().cardFont) setLocalCardFont(font);
    }
  } catch {
    /* offline: keep the last known totals */
  }
  try {
    const { data, error } = await db.from('user_study_days').select('day, xp').eq('user_id', id).gte('day', daysAgo(KEEP_DAYS));
    if (id !== userId) return;
    if (!error && data) {
      serverDays = {};
      for (const r of data) if (r.xp > 0) serverDays[r.day] = r.xp;
    }
  } catch {
    /* offline: keep the last known days */
  }
  loaded = true;
  persist();
  emit();
  void flush();
}

/** Credit XP now; it is sent to the database shortly, in one batch. */
export function addXp(amount: number): void {
  if (!(amount > 0)) return;
  const d = today();
  pending[d] = (pending[d] ?? 0) + Math.round(amount);
  persist();
  emit();
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flush(), FLUSH_DELAY);
}

/** Send waiting XP. Safe to call at any time; does nothing when there is nothing to send. */
export async function flush(): Promise<void> {
  if (flushing || sum(pending) <= 0 || !userId) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  flushing = true;
  try {
    send: for (const day of Object.keys(pending).sort()) {
      while ((pending[day] ?? 0) > 0) {
        const amount = Math.min(pending[day], BATCH_MAX);
        const { data, error } = await db.rpc('add_xp', { amount, study_day: day });
        if (error || typeof data !== 'number') break send; // offline, or not deployed yet: try again later
        pending[day] -= amount;
        if (pending[day] <= 0) delete pending[day];
        serverXp = data;
        serverDays[day] = (serverDays[day] ?? 0) + amount;
        persist();
        emit();
      }
    }
  } catch {
    /* network: the XP stays pending */
  } finally {
    flushing = false;
  }
}

export async function setBackground(id: string | null): Promise<void> {
  background = id;
  writeLocal('background-dirty', '1');
  persist();
  emit();
  try {
    const { error } = await db.rpc('set_background', { background_id: id });
    if (!error) writeLocal('background-dirty', null);
  } catch {
    /* kept on this device; sent with the next choice */
  }
}

/** Choose the flashcard script: shown at once, and saved to the account so the widget and other devices follow. */
export async function setCardFont(id: string): Promise<void> {
  setLocalCardFont(id);
  writeLocal('card-font-dirty', '1');
  try {
    const { error } = await db.rpc('set_card_font', { font_id: id });
    if (!error) writeLocal('card-font-dirty', null);
  } catch {
    /* kept on this device; sent with the next choice */
  }
}

/** The level the learner last saw celebrated on this device, to catch level-ups earned elsewhere (the widget). */
export function lastSeenLevel(): number | null {
  const n = readNum('level-seen');
  return n > 0 ? n : null;
}

export function markLevelSeen(level: number): void {
  writeLocal('level-seen', String(level));
}

export function currentUserId(): string | null {
  return userId;
}

export function currentLevel(): number {
  return levelFor(serverXp + sum(pending));
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flush());
}
