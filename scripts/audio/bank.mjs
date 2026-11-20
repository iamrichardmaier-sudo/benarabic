#!/usr/bin/env node
/**
 * Makes the recordings the app does not have yet, and keeps them.
 *
 * The queue (supabase/migrations/..._add_speech_queue.sql) lists every line
 * the app can say, most important first. This asks generate-speech for each
 * one that is not stored yet; generate-speech saves what it makes to the
 * word-audio bucket, which is where the app reads recordings from with no
 * voice service behind it. So running this while there is credit is what
 * makes the audio outlast the credit.
 *
 * Safe to stop and run again: a line already stored is never asked for twice.
 *
 *   BANK_TOKEN=... node scripts/audio/bank.mjs --dry-run
 *   BANK_TOKEN=... node scripts/audio/bank.mjs --max-tier 6
 *   BANK_TOKEN=... node scripts/audio/bank.mjs --max-tier 7 --max-chars 50000
 *
 * Refresh the queue first when cards have been added:  select * from fill_speech_queue();
 */
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../../.env', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=')).map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
    }),
);
const URL_BASE = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const TOKEN = process.env.BANK_TOKEN;
if (!TOKEN) throw new Error('Set BANK_TOKEN to the value in the speech_bank_config table.');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
const DRY = process.argv.includes('--dry-run');
const MAX_TIER = arg('max-tier', 99);
const MAX_CHARS = arg('max-chars', Infinity);
/** --skip-voice ar-shami leaves one voice's lines for later, e.g. until the voice is settled. */
const SKIP_VOICE = process.argv.includes('--skip-voice') ? process.argv[process.argv.indexOf('--skip-voice') + 1] : null;
/** The voice service makes five lines at once and refuses a sixth; the app may be asking too. */
const AT_ONCE = 3;

const headers = { Authorization: `Bearer ${KEY}`, apikey: KEY, 'Content-Type': 'application/json' };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function pending() {
  const all = [];
  // The API hands back at most 1000 rows a request.
  for (let from = 0; from < 200000; from += 1000) {
    const r = await fetch(`${URL_BASE}/rest/v1/rpc/pending_speech?limit=1000&offset=${from}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_token: TOKEN, p_max_tier: MAX_TIER }),
    });
    if (!r.ok) throw new Error(`Could not read the queue: ${r.status} ${await r.text()}`);
    const rows = await r.json();
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  return all;
}

/** 'ok', 'retry', 'skip' (this line cannot be made) or 'stop' (nothing more can be). */
async function make({ voice, line }) {
  for (let attempt = 0; attempt < 5; attempt++) {
    let r;
    try {
      r = await fetch(`${URL_BASE}/functions/v1/generate-speech`, {
        method: 'POST', headers, body: JSON.stringify({ text: line, voice }),
      });
    } catch {
      await wait(2000 * (attempt + 1));
      continue;
    }
    if (r.ok) {
      await r.arrayBuffer();
      return 'ok';
    }
    const body = await r.text();
    if (r.status === 429) {
      await wait(1500 * (attempt + 1));
      continue;
    }
    // The key refused or the credit gone: every further line would fail the same way.
    if (r.status === 401 || /not configured/.test(body)) return 'stop';
    if (attempt === 4) {
      console.error(`  could not make [${voice}] ${line}: ${r.status} ${body.slice(0, 120)}`);
      return 'skip';
    }
    await wait(1500 * (attempt + 1));
  }
  return 'skip';
}

const rows = (await pending()).filter((r) => r.voice !== SKIP_VOICE);
const byTier = new Map();
for (const r of rows) {
  const t = byTier.get(r.tier) ?? { lines: 0, chars: 0 };
  t.lines++;
  t.chars += r.line.length;
  byTier.set(r.tier, t);
}
console.log('Still to make:');
for (const [tier, t] of [...byTier].sort((a, b) => a[0] - b[0])) {
  console.log(`  tier ${tier}: ${t.lines} lines, ${t.chars} characters`);
}
console.log(`  total: ${rows.length} lines, ${rows.reduce((n, r) => n + r.line.length, 0)} characters`);
if (DRY || rows.length === 0) process.exit(0);

let made = 0, chars = 0, skipped = 0, stopped = false, next = 0;
const started = Date.now();
async function worker() {
  while (!stopped && next < rows.length) {
    const row = rows[next++];
    if (chars + row.line.length > MAX_CHARS) {
      stopped = true;
      console.log(`Stopping at the ${MAX_CHARS}-character limit.`);
      return;
    }
    // Counted before it is made, so three workers cannot overshoot the limit together.
    chars += row.line.length;
    const result = await make(row);
    if (result === 'ok') made++;
    else if (result === 'stop') {
      chars -= row.line.length;
      if (!stopped) console.log('The voice service refused: out of credit, or the key is gone. Stopping.');
      stopped = true;
    } else {
      chars -= row.line.length;
      skipped++;
    }
    if ((made + skipped) % 100 === 0 && made + skipped > 0) {
      const mins = ((Date.now() - started) / 60000).toFixed(1);
      console.log(`  ${made} made (${chars} characters), ${skipped} skipped, tier ${row.tier}, ${mins} min`);
    }
  }
}
await Promise.all(Array.from({ length: AT_ONCE }, worker));
console.log(`Done: ${made} recordings made, ${chars} characters, ${skipped} skipped.`);
