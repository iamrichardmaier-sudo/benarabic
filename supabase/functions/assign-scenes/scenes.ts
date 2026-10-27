/**
 * The prompt, schema and checks for assign-scenes, free of Deno and network
 * imports so they can be tested on their own.
 */
import catalog from "../_shared/card-scenes.json" with { type: "json" };

export interface PendingCard {
  word: string;
  english: string | null;
  word_type: string | null;
}

interface Scene {
  key: string;
  keywords: string[];
}

export const SCENE_KEYS: string[] = (catalog as Scene[]).map((s) => s.key);
const KEY_SET = new Set(SCENE_KEYS);

/** One line per scene — its key and what it pictures — for the model to choose from. */
const CATALOG_LINES = (catalog as Scene[])
  .map((s) => `${s.key}: ${s.keywords.slice(0, 10).join(", ")}`)
  .join("\n");

export const SYSTEM_PROMPT = `You choose the little animated picture shown beside a word on an Arabic learner's flashcard. Each picture is a cute, simple scene; the key and the ideas it pictures are listed below.

For each card you get its Arabic word, its English meaning and sometimes its word type. Pick the ONE scene that best captures the idea of the card's meaning, so that seeing the picture helps the learner recall the word.

- Picture the meaning, not the spelling or the root.
- Prefer the most concrete match: "bakery" → bread, "to drive" → car, "mother" → family, "minaret" → mosque.
- For abstract words, pick the scene that best evokes them: "patience" → snail, "freedom" → bird, "hope" → smile-sun, "to forgive" → mercy.
- For grammar words (prepositions, pronouns, particles, question words) use the scene that shows the relation: "in" → box, "on/above" → up, "under" → down, "from" → back, "to" → forward, "with" → together, "who/what/why" → question, "not/no" → wrong, "I/you/he" → person.
- For a whole sentence, picture its main idea.
- Only if nothing fits at all, use "language".

Scenes:
${CATALOG_LINES}

Return exactly one result per card, with its id echoed exactly.`;

export const RESULT_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          scene: { type: "string", enum: SCENE_KEYS },
        },
        required: ["id", "scene"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
};

export function buildInput(cards: PendingCard[]): string {
  return JSON.stringify(cards.map((c, i) => ({
    id: `c${i + 1}`,
    word: c.word,
    meaning: c.english ?? "",
    ...(c.word_type ? { type: c.word_type } : {}),
  })));
}

/** The model's picks matched back to the batch; an unknown or missing pick is left out. */
export function matchScenes(cards: PendingCard[], results: unknown[]): { card: PendingCard; scene: string }[] {
  const byId = new Map<string, string>();
  for (const r of results) {
    if (!r || typeof r !== "object") continue;
    const { id, scene } = r as Record<string, unknown>;
    if (typeof id === "string" && typeof scene === "string" && KEY_SET.has(scene) && !byId.has(id)) {
      byId.set(id, scene);
    }
  }
  return cards.flatMap((card, i) => {
    const scene = byId.get(`c${i + 1}`);
    return scene ? [{ card, scene }] : [];
  });
}
