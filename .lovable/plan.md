

# Make Learning Mode Stage 1 Bidirectional

## Problem
Stage 1 multiple choice currently only goes one direction: it shows the English word (+ image) and asks you to pick the correct Arabic word. You want it to also work the other way around.

## Solution
Randomly assign each Stage 1 card a direction when building the queue. Half the cards will show English and ask you to pick Arabic; the other half will show Arabic and ask you to pick English.

## How It Will Work

- **English prompt, Arabic answers**: Shows the English word + image on top, four Arabic word choices below (current behavior)
- **Arabic prompt, English answers**: Shows the Arabic word on top, four English word choices below

## Technical Details

**File: `src/components/LearningMode.tsx`**

1. **Add a direction to each queued item** -- Instead of the queue being `FlashCard[]`, it becomes `{ card: FlashCard; direction: 'en-to-ar' | 'ar-to-en' }[]`. When building the initial queue, randomly assign a direction to each card.

2. **Update `mcOptions`** -- Based on the current item's direction:
   - `en-to-ar`: Correct answer is `card.word` (Arabic), distractors are other Arabic words from `allCards` (current behavior)
   - `ar-to-en`: Correct answer is `card.english`, distractors are other English words from `allCards`; add English fallbacks like "water", "house", "tree" instead of Arabic ones

3. **Update `PromptDisplay`** -- Based on direction:
   - `en-to-ar`: Show English + Image (current behavior)
   - `ar-to-en`: Show the Arabic word in large text

4. **Update `handleMCAnswer`** -- Compare against the correct field based on direction (`card.word` for `en-to-ar`, `card.english` for `ar-to-en`)

5. **Update MC button styling** -- Remove `dir="rtl"` and `font-arabic` when options are in English

6. **Update feedback display** -- Show the correct answer in the appropriate language/script based on direction

No changes to Stage 2 (typing), database, or spaced repetition logic needed.
