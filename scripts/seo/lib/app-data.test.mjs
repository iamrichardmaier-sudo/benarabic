import { describe, it, expect } from 'vitest';
import { appData, shardOf, SHARDS } from './app-data.mjs';

function dictOf(entries) {
  const list = entries.map((e, id) => ({ et: '0', freq: 0, page: e.w, ...e, id }));
  const byRoot = new Map();
  for (const e of list) {
    if (!e.root) continue;
    if (!byRoot.has(e.root)) byRoot.set(e.root, []);
    byRoot.get(e.root).push(e);
  }
  return { entries: list, byRoot };
}

describe('the app dictionary data', () => {
  const dict = dictOf([
    { w: 'كَتَبَ', pos: 'verb', root: 'ك-ت-ب', form: 'I', freq: 9, masdar: ['كِتَابَة'], senses: [{ head: 'to write' }] },
    { w: 'كِتَابَة', pos: 'noun', root: 'ك-ت-ب', freq: 3, masdarOf: ['كَتَبَ'] },
    { w: 'مَعَ', pos: 'prep', freq: 20, senses: [{ head: 'with' }] },
  ]);
  const { index, shards } = appData(dict, { wordSlug: (e) => (e.id === 0 ? 'kataba' : null) });

  it('indexes every entry, most common first', () => {
    expect(index.map((r) => r[0])).toEqual([2, 0, 1]);
    expect(index.find((r) => r[0] === 0)[8]).toBe('kataba');
  });

  it('keeps a whole root in one shard, with its family', () => {
    const s = shards[shardOf({ root: 'ك-ت-ب' })];
    expect(Object.keys(s.entries).sort()).toEqual(['0', '1']);
    expect(s.families['ك-ت-ب'].groups[0].verb).toBe(0);
    expect(s.families['ك-ت-ب'].groups[0].connected[0]).toEqual(['كِتَابَة', 'verbal noun', 1]);
    expect(shards).toHaveLength(SHARDS);
  });

  it('gives a verbal noun defined only through its verb a meaning to list', () => {
    expect(index.find((r) => r[0] === 1)[3]).toBe('verbal noun of كَتَبَ (to write)');
  });
});
