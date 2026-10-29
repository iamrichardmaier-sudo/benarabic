// Run with: deno test supabase/functions/enrich-words/enrich.test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import { buildInput, matchResults, RESULT_SCHEMA, toEnrichment, type PendingWord } from "./enrich.ts";

const saved = (word: string, over: Partial<PendingWord> = {}): PendingWord => ({
  word, english: null, shaami: null, root: null, word_type: null, verb_form: null, gender: null, ...over,
});

const good = {
  id: "w1",
  english: "to write",
  wordVoweled: "كَتَبَ",
  root: "ك-ت-ب",
  wordType: "verb",
  verbForm: "i",
  pastTense: "كَتَبَ",
  presentTense: "يَكْتُبُ",
  masdarForm: "كِتابَة",
  gender: "m",
  fushaPlural: "كُتُب",
  shaami: "كتب",
  shaamiPlural: "",
  fushaSentence: "كَتَبَ أَخِي رِسالَةً طَوِيلَةً إِلى جَدَّتِهِ.",
  fushaSentenceEn: "My brother wrote a long letter to his grandmother.",
  shaamiSentence: "عم بكتب رسالة لستّي هلّق.",
  shaamiSentenceEn: "I'm writing a letter to my grandma now.",
  rootFamily: [
    { word: "كِتاب", english: "book", type: "Noun" },
    { word: "مَكْتَب", english: "office, desk", type: "Noun of place" },
    { word: "كاتِب", english: "writer", type: "Active participle" },
    { word: "مَكْتَبَة", english: "library", type: "Noun of place" },
    { word: "كَتَبَ", english: "to write", type: "Form I verb" },
    { word: "", english: "blank", type: "x" },
  ],
};

Deno.test("buildInput sends ids and only the details already known", () => {
  const input = JSON.parse(buildInput([saved("كتب", { english: "to write" }), saved("بيت")]));
  assertEquals(input, [
    { id: "w1", word: "كتب", english: "to write" },
    { id: "w2", word: "بيت" },
  ]);
});

Deno.test("toEnrichment keeps a good result and shapes the root family", () => {
  const e = toEnrichment(good, saved("كَتَبَ"));
  assert(typeof e !== "string");
  assertEquals(e.verb_form, "I");
  assertEquals(e.fusha_sentence, good.fushaSentence);
  assertEquals(e.shaami_sentence_en, good.shaamiSentenceEn);
  // A verb has no gender or plural; the saved word and blanks leave the family.
  assertEquals(e.gender, "");
  assertEquals(e.fusha_plural, "");
  assertEquals(e.root_family.map((f) => f.word), ["كِتاب", "مَكْتَب", "كاتِب", "مَكْتَبَة"]);
  assertEquals(e.companion_forms[0], { form: "كِتاب", label: "Noun — book" });
});

Deno.test("toEnrichment keeps gender and plurals for a noun", () => {
  const e = toEnrichment({ ...good, wordType: "noun", gender: "f", shaamiPlural: "سيارات" }, saved("سيارة"));
  assert(typeof e !== "string");
  assertEquals(e.gender, "f");
  assertEquals(e.fusha_plural, "كُتُب");
  assertEquals(e.shaami_plural, "سيارات");
});

Deno.test("toEnrichment blanks word-level fields for a sentence card", () => {
  const e = toEnrichment({ ...good, wordType: "sentence" }, saved("شو بدك"));
  assert(typeof e !== "string");
  assertEquals(e.root, "");
  assertEquals(e.shaami, "");
  assertEquals(e.root_family, []);
  assertEquals(e.companion_forms, []);
});

Deno.test("toEnrichment rejects a result missing either sentence or a translation", () => {
  assertEquals(toEnrichment({ ...good, fushaSentence: "" }, saved("كتب")), "no Fusha sentence");
  assertEquals(toEnrichment({ ...good, shaamiSentence: "I write" }, saved("كتب")), "no Shaami sentence");
  assertEquals(toEnrichment({ ...good, fushaSentenceEn: " " }, saved("كتب")), "missing a sentence translation");
  assertEquals(toEnrichment(null, saved("كتب")), "result is not an object");
});

Deno.test("matchResults pairs results by id and reports missing ones", () => {
  const words = [saved("كتب"), saved("بيت")];
  const out = matchResults(words, [{ ...good, id: "w1" }]);
  assert(typeof out[0].outcome !== "string");
  assertEquals(out[1].outcome, "no result returned");
});

Deno.test("the schema requires every field it defines", () => {
  const item = RESULT_SCHEMA.properties.results.items;
  assertEquals([...item.required].sort(), Object.keys(item.properties).sort());
});
