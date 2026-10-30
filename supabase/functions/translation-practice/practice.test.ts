// Run with: deno test supabase/functions/translation-practice/practice.test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  applyVerification, buildVerifyPrompt, closestReference, exactMatchFeedback, normalize,
  parseChallenges, parseGrade, rebuild, similarity, weakSpots, type Feedback,
} from "./practice.ts";

const refs = [
  "لو كنت أعرف الحقيقة لما ذهبت إلى الاجتماع",
  "لو عرفت الحقيقة لما حضرت الاجتماع",
];

Deno.test("normalize ignores vowels, spelling variants and punctuation", () => {
  assertEquals(normalize("لَوْ كُنْتُ أَعْرِفُ الحَقِيقَةَ،"), normalize("لو كنت اعرف الحقيقه"));
  assertEquals(normalize("إلى  مستشفى."), "الي مستشفي");
});

Deno.test("an attempt matching a reference is correct without a model", () => {
  const f = exactMatchFeedback("لَوْ عَرَفْتُ الحقيقة لما حضرت الاجتماع.", refs);
  assert(f);
  assertEquals(f.verdict, "correct");
  assertEquals(f.exact_match, true);
  assertEquals(exactMatchFeedback("لو عرفت الحقيقة لذهبت", refs), null);
});

Deno.test("the closest reference is the one sharing most words", () => {
  assertEquals(closestReference("لو عرفت الحقيقة ما حضرت الاجتماع", refs), refs[1]);
  assert(similarity("a b c", "a b c") === 1);
  assertEquals(similarity("", "a"), 0);
});

Deno.test("parseChallenges keeps three usable sentences and drops empty ones", () => {
  const good = (n: number) => ({
    english: `Sentence ${n}`, grammar_focus: "لو", target_words: ["عرف"],
    reference_translations: ["أ", "أ", " ب "], pitfalls: [],
  });
  const out = parseChallenges({ sentences: [good(1), { english: "", reference_translations: ["x"] }, good(2), good(3), good(4)] });
  assertEquals(out.length, 3);
  assertEquals(out[0].reference_translations, ["أ", "ب"]);
  let threw = false;
  try { parseChallenges({ sentences: [good(1)] }); } catch { threw = true; }
  assert(threw);
});

const graded = () =>
  parseGrade({
    verdict: "errors",
    summary: "Close.",
    closest_correct: "لو عرفتُ الحقيقةَ لما حضرت الاجتماع",
    words: [
      { yours: "إذا", correct: "لو", status: "fix", rule: "Counterfactual conditions take لو", note: "" },
      { yours: "عرفت", correct: "عرفت", status: "ok", rule: "", note: "" },
      { yours: "الحقيقة", correct: "الحقيقة", status: "fix", rule: "", note: "no rule, no change" },
      { yours: "", correct: "لما", status: "add", rule: "The answer of لو takes لـ", note: "" },
      { yours: "حضرت", correct: "حضرت", status: "ok", rule: "", note: "" },
    ],
    tips: ["a", "b", "c", "d"],
  }, refs[1]);

Deno.test("parseGrade turns rule-less or empty fixes into alternatives", () => {
  const f = graded();
  assertEquals(f.words[2].status, "alternative");
  assertEquals(f.tips.length, 3);
  assertEquals(f.verdict, "errors");
  assertEquals(f.verified, false);
});

Deno.test("a 'correct' verdict with corrections, or 'errors' with none, is settled", () => {
  const f = parseGrade({ verdict: "correct", summary: "", closest_correct: "", words: [
    { yours: "x", correct: "y", status: "fix", rule: "r", note: "" },
  ], tips: [] }, "");
  assertEquals(f.verdict, "minor");
  const g = parseGrade({ verdict: "errors", summary: "", closest_correct: "", words: [], tips: [] }, "");
  assertEquals(g.verdict, "correct");
});

Deno.test("the verify prompt lists only corrections, by their index", () => {
  const p = buildVerifyPrompt("If I had known", "إذا عرفت الحقيقة حضرت", graded());
  assert(p.includes("#0:"));
  assert(p.includes("#3: add"));
  assert(!p.includes("#1:"));
});

Deno.test("corrections the second check does not confirm stop being errors", () => {
  const f = applyVerification(graded(), {
    checks: [
      { index: 0, confirmed: true, reason: "إذا is not counterfactual" },
      { index: 3, confirmed: false, reason: "optional" },
    ],
  });
  assertEquals(f.verified, true);
  assertEquals(f.words.map((w) => w.status), ["fix", "ok", "alternative", "ok"]);
  assertEquals(f.verdict, "errors");
  assertEquals(f.closest_correct, "لو عرفت الحقيقة حضرت");
});

Deno.test("when no correction is confirmed the attempt counts as correct", () => {
  const f = applyVerification(graded(), { checks: [{ index: 0, confirmed: false, reason: "إذا is fine here" }] });
  assertEquals(f.verdict, "correct");
  assertEquals(f.words[0].status, "alternative");
  assert(f.words[0].note.includes("إذا is fine here"));
  assertEquals(f.words[0].correct, "إذا");
});

Deno.test("weakSpots counts the rules broken most", () => {
  const fb = (rules: string[]): Feedback => ({
    verdict: "errors", summary: "", closest_correct: "", closest_reference: "", tips: [], verified: true,
    words: rules.map((rule) => ({ yours: "a", correct: "b", status: "fix", rule, note: "" })),
  });
  assertEquals(weakSpots([fb(["لو", "case"]), fb(["لو"]), fb(["idafa"])], 2), ["لو", "case"]);
});

Deno.test("rebuild applies surviving fixes and keeps alternatives as written", () => {
  assertEquals(rebuild([
    { yours: "a", correct: "A", status: "fix", rule: "r", note: "" },
    { yours: "b", correct: "B", status: "alternative", rule: "", note: "" },
    { yours: "c", correct: "", status: "remove", rule: "r", note: "" },
    { yours: "", correct: "d", status: "add", rule: "r", note: "" },
  ]), "A b d");
});
