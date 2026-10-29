import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { SCENES, guessScene, sceneByKey, sceneForCard } from './card-scenes';
import { SCENE_ICONS } from './card-scene-icons';

describe('scene catalog', () => {
  it('has unique keys and keywords on every scene', () => {
    const keys = SCENES.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(SCENES.length).toBeGreaterThan(200);
    for (const s of SCENES) expect(s.keywords.length).toBeGreaterThan(0);
  });

  it('has a bundled icon for every scene, and the generated icon map is up to date', () => {
    for (const s of SCENES) expect(SCENE_ICONS[s.icon], s.key).toBeDefined();
    // Edit the JSON, then run: node scripts/generate-card-scene-icons.mjs
    const generated = fs.readFileSync('src/lib/card-scene-icons.ts', 'utf8');
    const used = [...new Set(SCENES.map((s) => s.icon))].sort();
    expect(Object.keys(SCENE_ICONS).sort()).toEqual(used);
    for (const icon of used) expect(generated).toContain(`  ${icon}: ${icon}Icon,`);
  });
});

describe('guessScene', () => {
  it.each([
    ['coffee', 'coffee'],
    ['to write', 'write'],
    ['books', 'book'],
    ['to sleep', 'sleep'],
    ['mother', 'family'],
    ['rain', 'rain'],
    ['to want', 'target'],
    ['red', 'rainbow'],
    ['with', 'together'],
    ['what?', 'question'],
    ['the sea', 'sea'],
    ['disciple', 'friend'],
    ['God', 'god'],
  ])('pictures "%s" as %s', (english, key) => {
    expect(guessScene(english).key).toBe(key);
  });

  it('falls back to a neutral scene, and a speech bubble for an unmatched sentence', () => {
    expect(guessScene('xylophonic').key).toBe('language');
    expect(guessScene(null).key).toBe('language');
    expect(guessScene('zzqx', 'sentence').key).toBe('speech-bubble');
  });
});

describe('sceneForCard', () => {
  it('uses the scene stored on the card, and guesses when there is none or it is unknown', () => {
    expect(sceneForCard({ scene: 'tea', english: 'coffee' }).key).toBe('tea');
    expect(sceneForCard({ scene: null, english: 'coffee' }).key).toBe('coffee');
    expect(sceneForCard({ scene: 'retired-scene', english: 'coffee' }).key).toBe('coffee');
    expect(sceneByKey(undefined)).toBeUndefined();
  });
});
