import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

// Runs the Scriptable widget's XP-sending code (scripts/scriptable/wazn-review.js)
// against stand-ins for Scriptable's Request and Keychain.
const src = readFileSync('scripts/scriptable/wazn-review.js', 'utf8');
const slice = (from: string, to: string) => src.slice(src.indexOf(from), src.indexOf(to));
const code = [
  slice('function isoDay(', '// ------------------------------------------------------------------ auth'),
  slice('/**\n * Sends one day\'s XP', '/** The learner\'s XP, chosen background'),
].join('\n');

interface Call { url: string; method: string; body?: string }
let calls: Call[];
let server: { status: number; reply: string; days: { day: string; xp: number }[] | { message: string } };
let keychain: Map<string, string>;

function load() {
  class Request {
    url: string; method = 'GET'; headers: Record<string, string> = {}; body?: string;
    response: { statusCode: number } | null = null;
    constructor(url: string) { this.url = url; }
    async loadString() { calls.push({ url: this.url, method: this.method, body: this.body }); this.response = { statusCode: server.status }; return server.reply; }
    async loadJSON() { calls.push({ url: this.url, method: this.method }); this.response = { statusCode: 200 }; return server.days; }
  }
  const Keychain = {
    contains: (k: string) => keychain.has(k),
    get: (k: string) => keychain.get(k),
    set: (k: string, v: string) => void keychain.set(k, v),
    remove: (k: string) => void keychain.delete(k),
  };
  return new Function('Request', 'Keychain', 'SUPABASE_URL', 'restHeaders',
    `${code}; return { addXp, readPendingXp };`)(Request, Keychain, 'https://x', () => ({}));
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

beforeEach(() => {
  calls = [];
  keychain = new Map();
  server = { status: 200, reply: '1270', days: [] };
});

describe('widget XP', () => {
  it('counts a save as done when the database answers with a bare number', async () => {
    keychain.set('wazn.xp-queue-checked', '1');
    const { addXp, readPendingXp } = load();
    const r = await addXp('t', 110);
    expect(r).toEqual({ total: 1270, waiting: 0 });
    expect(readPendingXp()).toEqual({});
    expect(calls.filter((c) => c.url.includes('add_xp'))).toHaveLength(1);
    expect(JSON.parse(calls[0].body!)).toEqual({ amount: 110, study_day: today() });
  });

  it('keeps the XP when the database refuses it', async () => {
    keychain.set('wazn.xp-queue-checked', '1');
    server.status = 404;
    const { addXp, readPendingXp } = load();
    expect(await addXp('t', 50)).toEqual({ total: null, waiting: 50 });
    expect(readPendingXp()).toEqual({ [today()]: 50 });
  });

  it('drops XP the old version queued but the database already has, once', async () => {
    keychain.set('wazn.xp-pending', JSON.stringify({ '2026-10-26': 185 }));
    server.days = [{ day: '2026-10-26', xp: 480 }];
    const { addXp } = load();
    expect(await addXp('t', 110)).toEqual({ total: 1270, waiting: 0 });
    const sends = calls.filter((c) => c.url.includes('add_xp')).map((c) => JSON.parse(c.body!));
    expect(sends).toEqual([{ amount: 110, study_day: today() }]);
    expect(keychain.get('wazn.xp-queue-checked')).toBe('1');
  });

  it('still sends queued XP the database does not have', async () => {
    keychain.set('wazn.xp-pending', JSON.stringify({ '2026-10-25': 40 }));
    server.days = [];
    const { addXp } = load();
    await addXp('t', 0);
    const sends = calls.filter((c) => c.url.includes('add_xp')).map((c) => JSON.parse(c.body!));
    expect(sends).toEqual([{ amount: 40, study_day: '2026-10-25' }]);
  });

  it('drops nothing, and checks again next time, if the database cannot be asked', async () => {
    keychain.set('wazn.xp-pending', JSON.stringify({ '2026-10-26': 185 }));
    server.days = { message: 'offline' };
    server.status = 500;
    const { addXp, readPendingXp } = load();
    await addXp('t', 0);
    expect(readPendingXp()).toEqual({ '2026-10-26': 185 });
    expect(keychain.has('wazn.xp-queue-checked')).toBe(false);
  });
});
