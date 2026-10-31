/**
 * Checks a daily translation answer key with the app's own grader, and prints
 * the SQL that loads it.
 *
 *   node --experimental-strip-types scripts/check-answer-key.ts supabase/answer-keys/<day>.json
 *   node --experimental-strip-types scripts/check-answer-key.ts <key.json> --try '{"1": ["attempt", ...]}'
 *   node --experimental-strip-types scripts/check-answer-key.ts <key.json> --sql <user-id>
 *
 * A key passes when every stored correct translation and the model answer
 * come back correct on every chunk, and every predicted mistake is caught as
 * written. Exits non-zero otherwise. See supabase/answer-keys/README.md.
 */
import { readFileSync } from 'node:fs';
import { checkChunks, findForm, gradeWithKey, type AnswerKey, type KeyChunk } from '../src/lib/answer-key.ts';

interface KeySentence extends AnswerKey {
  position: number;
  english: string;
  grammar_focus: string;
  target_words: string[];
  reference_translations: string[];
  pitfalls: string[];
}

interface KeyFile {
  day: string;
  sentences: KeySentence[];
}

const [, , path, flag, arg] = process.argv;
if (!path) {
  console.error('Usage: node --experimental-strip-types scripts/check-answer-key.ts <key.json> [--try <json> | --sql <user-id>]');
  process.exit(2);
}
const key = JSON.parse(readFileSync(path, 'utf8')) as KeyFile;

const problems: string[] = [];
const fail = (s: KeySentence, msg: string) => problems.push(`sentence ${s.position}: ${msg}`);

if (!/^\d{4}-\d{2}-\d{2}$/.test(key.day ?? '')) problems.push('day must be yyyy-mm-dd');
const positions = (key.sentences ?? []).map((s) => s.position).sort().join(',');
if (positions !== '1,2,3') problems.push(`expected sentences 1, 2 and 3, found ${positions || 'none'}`);

for (const s of key.sentences ?? []) {
  if (!s.english?.trim()) fail(s, 'english is empty');
  if (!s.model_answer?.trim()) fail(s, 'model_answer is empty');
  if ((s.reference_translations ?? []).length < 4) fail(s, 'needs at least 4 reference_translations');
  if ((s.chunks ?? []).length < 3) fail(s, 'needs at least 3 chunks');

  // Every correct translation must come back correct, chunk by chunk.
  for (const r of [...(s.reference_translations ?? []), s.model_answer]) {
    for (const res of checkChunks(s, r)) {
      if (res.status !== 'ok') fail(s, `correct translation not accepted by chunk "${res.chunk.en}" (${res.status}): ${r}`);
    }
  }

  // Every predicted mistake must be found where it is written, and must not
  // be swallowed by an accepted form of its own chunk.
  for (const chunk of s.chunks ?? []) {
    if ((chunk.accept ?? []).length === 0) fail(s, `chunk "${chunk.en}" has no accepted forms`);
    for (const m of chunk.mistakes ?? []) {
      if (!m.rule?.trim() || !m.note?.trim()) fail(s, `mistake "${m.text}" needs a rule and a note`);
      if (!findForm(m.text, m.text, Boolean(m.strict))) fail(s, `mistake "${m.text}" has no words`);
      const solo: KeyChunk = { ...chunk };
      const res = checkChunks({ model_answer: '', chunks: [solo] }, m.text)[0];
      const caught = res.mistakes.some((x) => x.mistake === m);
      if (!caught && res.status === 'ok') fail(s, `mistake "${m.text}" is accepted as correct by chunk "${chunk.en}"`);
      else if (!caught) fail(s, `mistake "${m.text}" is not caught by its own chunk "${chunk.en}"`);
    }
  }
}

if (flag === '--try' && arg) {
  const tries = JSON.parse(arg) as Record<string, string[]>;
  for (const s of key.sentences) {
    for (const attempt of tries[String(s.position)] ?? []) {
      const f = gradeWithKey(s, s.reference_translations, attempt);
      console.log(`\nSentence ${s.position}: ${attempt}\n  ${f.verdict}: ${f.summary}`);
      for (const w of f.words) console.log(`  [${w.status}] ${w.part}: ${w.yours}${w.rule ? ` (${w.rule})` : ''}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s) in ${path}:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.error(`${path}: OK (${key.sentences.length} sentences, ${key.sentences.reduce((n, s) => n + s.chunks.length, 0)} chunks, ${key.sentences.reduce((n, s) => n + s.chunks.reduce((m, c) => m + c.mistakes.length, 0), 0)} predicted mistakes)`);

if (flag === '--sql') {
  if (!/^[0-9a-f-]{36}$/.test(arg ?? '')) {
    console.error('--sql needs the learner\'s user id');
    process.exit(2);
  }
  const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
  const j = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;
  const rows = key.sentences.map((s) => `(${[
    q(arg), q(key.day), s.position, q(s.english), q(s.grammar_focus), j(s.target_words),
    j(s.reference_translations), j(s.pitfalls), j({ model_answer: s.model_answer, chunks: s.chunks }),
  ].join(', ')})`);
  console.log(`insert into public.translation_challenges
  (user_id, day, position, english, grammar_focus, target_words, reference_translations, pitfalls, answer_key)
values
${rows.join(',\n')}
on conflict (user_id, day, position) do update set
  english = excluded.english, grammar_focus = excluded.grammar_focus, target_words = excluded.target_words,
  reference_translations = excluded.reference_translations, pitfalls = excluded.pitfalls, answer_key = excluded.answer_key
returning day, position, answer_key is not null as has_key;`);
}
