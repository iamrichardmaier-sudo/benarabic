

# Add Arabic TTS SpeakButton

## What we're building
A speaker button next to Arabic words that uses browser SpeechSynthesis to pronounce them. Also auto-speaks the correct answer on quiz/review submission.

## Steps

### 1. Create `src/components/SpeakButton.tsx`
Small volume icon button. Calls `window.speechSynthesis.speak()` with `lang: 'ar-SA'`, `rate: 0.8`. Accepts `word: string` prop. Shows subtle visual feedback while speaking.

### 2. Add to Flashcard (`src/components/Flashcard.tsx`)
- Speaker button next to the Arabic word on front and back
- Auto-speak the Arabic word when card is flipped (revealed)

### 3. Add to PluralDrill QuizScreen (`src/components/PluralDrill/QuizScreen.tsx`)
- Speaker button next to the singular Arabic word in the quiz card
- Auto-speak the correct plural when feedback is shown (on submit)
- Speaker button next to the correct answer in feedback

### 4. Add to LearningMode (`src/components/LearningMode.tsx`)
- Speaker button next to Arabic prompts
- Auto-speak the correct answer on submit feedback

### 5. Add to DeckList (`src/components/DeckList.tsx`)
- Small speaker button next to each Arabic word in the list

## Technical notes
- Uses `SpeechSynthesisUtterance` with `lang: 'ar-SA'`, falls back to any `ar-*` voice
- Rate 0.8 for clarity
- No API keys needed
- Quality varies by device/browser

