

# Fix Learning Mode Stage 1: Bidirectional MC with Consistent Languages

## The Problem
The last change reverted Stage 1 MC to one-direction only (English prompt, Arabic answers). Your original request was to have **bidirectional** MC where each question uses one consistent language for all options -- but that got lost when the "flexible validation" changes were applied. The bidirectional queue code was removed entirely, so nothing visibly changed.

## What Will Change

### Stage 1 Multiple Choice (Learning Mode) -- Restore Bidirectional
Each card in Stage 1 will be randomly assigned a direction:

- **English prompt, Arabic answers (~50%)**: Shows image + English word on top, four Arabic choices below (all Arabic)
- **Arabic prompt, English answers (~50%)**: Shows Arabic word on top, four English choices below (all English)

### Stage 2 Typing (Learning Mode) -- Keep as English to Arabic
Stage 2 stays the same: show image + English, user types Arabic. The flexible validation (strip diacritics, handle slash-separated variants) is already implemented and will remain.

### Review Mode -- Already Bidirectional
The review flashcard mode already randomizes direction. No changes needed there.

## Technical Details

**File: `src/components/LearningMode.tsx`**

1. **Restore `MCDirection` type and `QueueItem` interface**: Change the queue from `FlashCard[]` back to `{ card: FlashCard; direction: MCDirection }[]` for Stage 1 only. Randomly assign `'en-to-ar'` or `'ar-to-en'` to each card.

2. **Update `mcOptions` generation**: Based on current item's direction:
   - `en-to-ar`: correct = `card.word`, distractors from other cards' `.word` fields (Arabic), Arabic fallbacks
   - `ar-to-en`: correct = `card.english`, distractors from other cards' `.english` fields (English), English fallbacks like "water", "house", "tree"

3. **Update `PromptDisplay`**: Accept direction prop:
   - `en-to-ar`: Show image + English (current)
   - `ar-to-en`: Show Arabic word in large text

4. **Update `handleMCAnswer`**: Compare selected answer against correct field based on direction

5. **Update MC button styling**: Remove `dir="rtl"` and `font-arabic` when options are English

6. **Update feedback display**: Show correct answer in appropriate language/script

7. **Keep Stage 2 unchanged**: Always English prompt, Arabic typing, with the flexible validation already in place
