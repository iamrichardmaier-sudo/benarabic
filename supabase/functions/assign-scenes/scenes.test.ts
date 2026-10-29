// Run with: deno test supabase/functions/assign-scenes/scenes.test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import { buildInput, matchScenes, RESULT_SCHEMA, SCENE_KEYS, SYSTEM_PROMPT } from "./scenes.ts";

Deno.test("every scene the prompt names as an example exists", () => {
  for (const m of SYSTEM_PROMPT.matchAll(/→ ([a-z-]+)/g)) assert(SCENE_KEYS.includes(m[1]), m[1]);
  assert(SCENE_KEYS.includes("language"));
});

Deno.test("the schema only allows catalog keys", () => {
  assertEquals(RESULT_SCHEMA.properties.results.items.properties.scene.enum, SCENE_KEYS);
  assertEquals(new Set(SCENE_KEYS).size, SCENE_KEYS.length);
});

Deno.test("buildInput gives each card an id, its word and meaning", () => {
  assertEquals(JSON.parse(buildInput([
    { word: "قهوة", english: "coffee", word_type: "noun" },
    { word: "في", english: null, word_type: null },
  ])), [
    { id: "c1", word: "قهوة", meaning: "coffee", type: "noun" },
    { id: "c2", word: "في", meaning: "" },
  ]);
});

Deno.test("matchScenes keeps known picks by id and drops unknown or missing ones", () => {
  const cards = [
    { word: "قهوة", english: "coffee", word_type: null },
    { word: "نام", english: "to sleep", word_type: null },
    { word: "في", english: "in", word_type: null },
  ];
  const out = matchScenes(cards, [
    { id: "c1", scene: "coffee" },
    { id: "c2", scene: "not-a-scene" },
    { id: "c1", scene: "tea" },
  ]);
  assertEquals(out, [{ card: cards[0], scene: "coffee" }]);
});
