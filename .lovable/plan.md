

# 4 New Features for Arabic Flashcard App

## Feature 1: Relearn Tool

**What it does**: Adds a "Relearn Cards" button on the home screen. Opens a full-screen modal listing all cards with checkboxes. Selected cards get their SRS fields reset (easeFactor to 2.5, intervalDays to 0, learningStage to 'new', stage1Attempts/stage2Attempts to 0, nextReviewDate to today), then the user is sent into the Learn New Words flow.

**Files to change**:
- `src/pages/Index.tsx` -- Add "Relearn Cards" button to the grid, add state for modal visibility, selected card IDs, and the relearn flow
- Create `src/components/RelearnModal.tsx` -- Full-screen modal with:
  - Header "Select Cards to Relearn"
  - Select All / Deselect All toggle
  - Scrollable card list (Arabic left, English right, checkbox)
  - "Start Relearning (X cards)" button, disabled when 0 selected
  - Close button

**Reset logic**: For each selected card, call `updateCard(id, { easeFactor: 2.5, intervalDays: 0, learningStage: 'new', stage1Attempts: 0, stage2Attempts: 0, nextReviewDate: today })`. Then navigate to the Learn view.

---

## Feature 2: Swap Arabic/English in My Deck

**What it does**: Adds a swap button (ArrowLeftRight icon) to each card row in My Deck. Clicking swaps the `word` and `english` fields for that card.

**Files to change**:
- `src/components/DeckList.tsx` -- Add swap button to the action buttons group, implement `handleSwap` that calls `onUpdateCard(id, { word: card.english, english: card.word })`, show a temporary "Swapped!" badge that disappears after 2 seconds

---

## Feature 3: Color-coded Difficulty Shading in My Deck

**What it does**: Each card row in My Deck gets a background color based on SRS data:
- Light red `#ffe5e5`: easeFactor < 2.0, or (stage2Attempts >= 3 AND intervalDays <= 1) -- struggling
- Light green `#e5ffe8`: easeFactor >= 2.5 AND stage2Attempts >= 3 AND intervalDays >= 7 -- well-known
- Default (no color): everything else
- Green takes priority if both conditions match

**Files to change**:
- `src/components/DeckList.tsx` -- Add a helper function `getCardColor(card)` that returns the appropriate background color, apply it as inline style on the card row container

**Note on field mapping**: The user mentioned `repetitions` and `interval` -- in the actual codebase these map to `stage2Attempts` (closest to repetitions count) and `intervalDays`. The `ease` maps to `easeFactor`.

---

## Feature 4: Export Deck to PDF

**What it does**: Adds an "Export PDF" button in the My Deck header. Generates and downloads a PDF with a table of all cards.

**New dependencies**: `jspdf` and `jspdf-autotable`

**Files to change**:
- `src/components/DeckList.tsx` -- Add "Export PDF" button in header area, implement PDF generation function

**PDF structure**:
- Title: "My Arabic Flashcard Deck" (bold, 18px)
- Subtitle: "Exported on [date]" (gray, 11px)
- Table columns: #, Arabic Word, English Translation, Times Reviewed, Next Review
- Alternating row shading (white / #f9f9f9)
- Color-coded rows matching the difficulty shading logic
- Filename: `arabic-flashcards-YYYY-MM-DD.pdf`
- Empty deck shows `alert("Your deck is empty -- nothing to export.")`

**Arabic font handling**: jsPDF doesn't natively support Arabic. I'll use the standard approach of embedding an Arabic-compatible font (Amiri or similar) as a base64 string, or use the built-in Helvetica with a note that Arabic rendering may be limited. The most reliable approach is to add the Arabic text as-is and rely on jspdf-autotable's text rendering.

---

## Technical Details

```text
Files created:
  src/components/RelearnModal.tsx  (new)

Files modified:
  src/pages/Index.tsx              (add Relearn button + modal state + flow)
  src/components/DeckList.tsx      (swap button, color shading, export PDF button)

Dependencies added:
  jspdf
  jspdf-autotable
```

No changes to LearningMode.tsx, spaced-repetition.ts, or the review/SRS logic.

