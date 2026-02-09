

# Move Flashcard Storage to the Cloud Database

Currently your flashcards are stored in the browser's local storage, which means they disappear when the preview URL changes or the browser cache is cleared. This plan migrates everything to your Lovable Cloud database so your words are saved permanently and accessible from any device.

---

## What You'll Get

- Permanent storage of all your flashcards in the cloud
- A simple sign-up/login page so your cards are tied to your account
- Everything else (learning mode, review, deck list, etc.) works exactly the same

---

## Steps

### 1. Create the flashcards table in the database
A `flashcards` table with all the fields your app already uses: word, english, image URL, review scheduling data, learning stage, and attempt counters. Each row is linked to the user who created it.

Row-level security policies will ensure users can only see and modify their own cards.

### 2. Add authentication (sign-up and login)
A simple auth page with email and password sign-up/login. You'll need to verify your email before signing in. The app will redirect unauthenticated users to the login page.

### 3. Update the app to read/write from the database instead of localStorage
- Replace `loadCards()` (which reads localStorage) with a database query
- Replace `saveCards()` with individual database insert/update/delete operations
- The add words, review, learning mode, and deck list screens will all use the database automatically

### 4. One-time localStorage migration
On first login, if you have existing cards in localStorage, they'll be automatically imported into your database account so nothing is lost.

---

## Technical Details

**Database migration SQL:**
- Create `flashcards` table with columns: `id`, `user_id`, `word`, `english`, `image_url`, `next_review_date`, `interval_days`, `ease_factor`, `learning_stage`, `stage1_attempts`, `stage2_attempts`, `created_at`
- Enable RLS with policies: users can only SELECT/INSERT/UPDATE/DELETE their own rows (where `user_id = auth.uid()`)
- Default `user_id` to `auth.uid()` so inserts don't need to specify it explicitly

**New files:**
- `src/pages/Auth.tsx` -- sign-up/login page
- `src/hooks/useFlashcards.ts` -- React Query hook replacing localStorage calls

**Modified files:**
- `src/lib/storage.ts` -- rewritten to use database queries via the client SDK
- `src/pages/Index.tsx` -- use new database-backed hook instead of `loadCards`/`saveCards`
- `src/App.tsx` -- add auth route and protected route wrapper
- `src/components/AddWords.tsx`, `DeckList.tsx`, `LearningMode.tsx` -- minor adjustments for async save operations

**Auth configuration:**
- Email + password authentication
- Email confirmation required before sign-in

