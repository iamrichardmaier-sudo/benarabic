import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listFlashcards from "./tools/list-flashcards";
import createFlashcard from "./tools/create-flashcard";
import getDueCards from "./tools/get-due-cards";
import deleteFlashcard from "./tools/delete-flashcard";
import getStudyXp from "./tools/get-study-xp";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "arabic-flashcards-mcp",
  title: "Arabic Flashcards",
  version: "0.1.0",
  instructions:
    "Tools for the user's Arabic flashcard deck. Use list_flashcards to browse cards, get_due_cards to see what is due for spaced-repetition review today, create_flashcard to add new Arabic/English words, delete_flashcard to remove one, and get_study_xp for the learner's XP per study day. All actions are scoped to the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listFlashcards, getDueCards, createFlashcard, deleteFlashcard, getStudyXp],
});
