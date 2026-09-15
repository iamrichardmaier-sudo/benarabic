import { useState } from 'react';
import { Check, Plus, Loader2 } from 'lucide-react';
import { useDeck } from '@/contexts/DeckContext';
import { useDeckActions, type NewWord } from '@/contexts/DeckActionsContext';
import { wordKey } from '@/lib/word-relations';

/**
 * "Add to my cards", on a word met while reading.
 *
 * The point of reading in this app is to meet words you don't know, so the
 * gap between meeting one and learning it should be a single tap. The card
 * lands unlearned, which is what puts it at the front of the Learn queue
 * rather than into a review schedule it has not earned yet.
 */
const AddWordButton = ({ word }: { word: NewWord }) => {
  const deck = useDeck();
  const { addWord } = useDeckActions();
  const [state, setState] = useState<'idle' | 'saving' | 'added'>('idle');

  if (!addWord) return null;

  // Already known: say so rather than offering to add it twice.
  const key = wordKey(word.word);
  const held =
    state === 'added' ||
    deck.some((c) => wordKey(c.word) === key || wordKey(c.wordVoweled) === key);

  const onClick = async () => {
    if (held || state === 'saving') return;
    setState('saving');
    try {
      await addWord(word);
      setState('added');
    } catch {
      // Nothing was saved, so leave the button offering the action again.
      setState('idle');
    }
  };

  if (held) {
    return (
      <p className="flex items-center justify-center gap-1.5 rounded-lg bg-success/10 py-1.5 text-xs font-medium text-success">
        <Check className="h-3.5 w-3.5" />
        In your cards
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === 'saving'}
      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground transition-all active:scale-95 disabled:opacity-60"
    >
      {state === 'saving' ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Plus className="h-3.5 w-3.5" />
      )}
      Add to my cards
    </button>
  );
};

export default AddWordButton;
