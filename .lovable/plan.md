
# Improve Review Flashcards

## Changes

### 1. Bidirectional review (Arabic-to-English AND English-to-Arabic)
Currently, review only shows the Arabic word on the front and reveals the image/English on the back. We'll add a second direction so each due card produces two review prompts:

- **Arabic to English**: Front shows the Arabic word, back shows the English + image
- **English to Arabic**: Front shows the English word + image, back reveals the Arabic word

The due cards list will be shuffled with both directions intermixed so you don't just see the same card twice in a row.

### 2. Always show the English word alongside images
Right now, if a card has an image, only the image is shown on the back (the English text is skipped). We'll update this so the English word is always displayed together with the image.

---

## Technical Details

**File: `src/components/Flashcard.tsx`**

- Add a `direction` prop: `'ar-to-en' | 'en-to-ar'` (default `'ar-to-en'`)
- When direction is `ar-to-en`: front shows Arabic, back shows English + image
- When direction is `en-to-ar`: front shows English + image, back shows Arabic
- Update `renderBack()` to always show the English word below/above the image (instead of image-only)

**File: `src/pages/Index.tsx`**

- Update `startReview()` to create two entries per due card (one for each direction), then shuffle
- Track direction alongside each review item
- Pass the direction to the `Flashcard` component

**No database or schema changes needed** -- this is purely a UI/logic change in how cards are presented during review.
