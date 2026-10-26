/**
 * The learner's XP and chosen background, shared by every screen.
 *
 * XP shows the moment it is earned and is sent to the database in batches
 * (add_xp in supabase/migrations/..._add_user_progress.sql). Until a batch is
 * confirmed it waits on this device, so XP earned offline, or before that
 * migration has been deployed, is kept and sent later rather than lost.
 */
import { supabase } from '@/integrations/supabase/client';
import { levelFor } from './levels';

export interface ProgressSnapshot {
  /** XP the database has confirmed plus XP still waiting to be sent. */
  xp: number;
  background: string | null;
  loaded: boolean;
}

// The generated Supabase types predate user_progress; this is the slice used here.
type LooseClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, v: string) => {
        maybeSingle: () => Promise<{ data: { xp: number; background: string | null } | null; error: { code?: string; message?: string } | null }>;
      };
    };
  };
};
const db = supabase as unknown as LooseClient;

const BATCH_MAX = 2000; // add_xp clamps a single call at this
const FLUSH_DELAY = 1500;

let userId: string | null = null;
let serverXp = 0;
let pending = 0;
let background: string | null = null;
let loaded = false;
let flushing = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let snapshot: ProgressSnapshot = { xp: 0, background: null, loaded: false };
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

function emit() {
  snapshot = { xp: serverXp + pending, background, loaded };
  for (const l of listeners) l();
}

function persist() {
  writeLocal('xp-pending', pending > 0 ? String(pending) : null);
  writeLocal('xp-confirmed', String(serverXp));
  writeLocal('background', background);
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
  pending = readNum('xp-pending');
  try {
    background = localStorage.getItem(key('background'));
  } catch {
    background = null;
  }
  loaded = false;
  emit();
  if (!id) return;
  try {
    const { data, error } = await db.from('user_progress').select('xp, background').eq('user_id', id).maybeSingle();
    if (id !== userId) return;
    if (!error) {
      serverXp = data?.xp ?? 0;
      // A choice made on this device while offline wins over the stored one.
      if (data?.background !== undefined && !localStorage.getItem(key('background-dirty'))) {
        background = data?.background ?? null;
      }
    }
  } catch {
    /* offline: keep the last known totals */
  }
  loaded = true;
  persist();
  emit();
  void flush();
}

/** Credit XP now; it is sent to the database shortly, in one batch. */
export function addXp(amount: number): void {
  if (!(amount > 0)) return;
  pending += Math.round(amount);
  persist();
  emit();
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flush(), FLUSH_DELAY);
}

/** Send waiting XP. Safe to call at any time; does nothing when there is nothing to send. */
export async function flush(): Promise<void> {
  if (flushing || pending <= 0 || !userId) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  flushing = true;
  try {
    while (pending > 0) {
      const amount = Math.min(pending, BATCH_MAX);
      const { data, error } = await db.rpc('add_xp', { amount });
      if (error || typeof data !== 'number') break; // offline, or not deployed yet: try again later
      pending -= amount;
      serverXp = data;
      persist();
      emit();
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

/** The level the learner last saw celebrated on this device, to catch level-ups earned elsewhere (the widget). */
export function lastSeenLevel(): number | null {
  const n = readNum('level-seen');
  return n > 0 ? n : null;
}

export function markLevelSeen(level: number): void {
  writeLocal('level-seen', String(level));
}

export function currentLevel(): number {
  return levelFor(serverXp + pending);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flush());
}
