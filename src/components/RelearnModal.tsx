import { useMemo, useState } from 'react';
import { FlashCard, isSentence } from '@/lib/spaced-repetition';
import { X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { sortChapterLabels } from '@/lib/chapter-sort';

interface RelearnModalProps {
  cards: FlashCard[];
  onClose: () => void;
  onStartRelearn: (cardIds: string[]) => void;
}

const UNGROUPED = 'Ungrouped';

const RelearnModal = ({ cards, onClose, onStartRelearn }: RelearnModalProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sentencesOnly, setSentencesOnly] = useState(false);

  const sentenceCount = useMemo(() => cards.filter(isSentence).length, [cards]);
  // What the list shows. With "sentences" on, only those are listed, so
  // Select All and the section toggles act on just them.
  const shown = useMemo(() => (sentencesOnly ? cards.filter(isSentence) : cards), [cards, sentencesOnly]);

  const allSelected = shown.length > 0 && shown.every((c) => selectedIds.has(c.id));

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const c of shown) {
        if (allSelected) next.delete(c.id);
        else next.add(c.id);
      }
      return next;
    });
  };

  /** Show only the sentences and select them all — or go back to the whole deck. */
  const toggleSentences = () => {
    if (sentencesOnly) {
      setSentencesOnly(false);
      return;
    }
    setSentencesOnly(true);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const c of cards) if (isSentence(c)) next.add(c.id);
      return next;
    });
  };

  const toggleCard = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSection = (sectionCards: FlashCard[]) => {
    const allInSection = sectionCards.every((c) => selectedIds.has(c.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const c of sectionCards) {
        if (allInSection) next.delete(c.id);
        else next.add(c.id);
      }
      return next;
    });
  };

  // Cards without a chapter land in one "Ungrouped" bucket. When every card
  // shares that bucket (no chapters have been assigned at all), skip the
  // section headers and fall back to the flat list this screen used to show.
  const sections = useMemo(() => {
    const byGroup = new Map<string, FlashCard[]>();
    for (const card of shown) {
      const key = card.group || UNGROUPED;
      const list = byGroup.get(key);
      if (list) list.push(card);
      else byGroup.set(key, [card]);
    }
    const namedGroups = sortChapterLabels([...byGroup.keys()].filter((g) => g !== UNGROUPED));
    const order = byGroup.has(UNGROUPED) ? [...namedGroups, UNGROUPED] : namedGroups;
    return order.map((name) => ({ name, cards: byGroup.get(name) as FlashCard[] }));
  }, [shown]);

  const showSections = sections.length > 1;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <h2 className="text-lg font-bold text-foreground">Select Cards to Relearn</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Select All toggle */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/50">
        <button
          onClick={toggleAll}
          className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
        {sentenceCount > 0 && (
          <button
            onClick={toggleSentences}
            aria-pressed={sentencesOnly}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              sentencesOnly
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-primary text-primary hover:bg-primary/10'
            }`}
          >
            {sentencesOnly ? `Showing sentences (${sentenceCount}) · show all` : `Sentences (${sentenceCount})`}
          </button>
        )}
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {shown.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No cards in your deck.</p>
        ) : (
          <div className="space-y-4">
            {sections.map((section) => (
              <div key={section.name} className="space-y-1">
                {showSections && (
                  <div className="flex items-center justify-between px-1 pt-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {section.name}
                    </p>
                    <button
                      onClick={() => toggleSection(section.cards)}
                      className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      {section.cards.every((c) => selectedIds.has(c.id)) ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                )}
                {section.cards.map((card) => (
                  <label
                    key={card.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedIds.has(card.id)}
                      onCheckedChange={() => toggleCard(card.id)}
                    />
                    {isSentence(card) ? (
                      // A sentence is long: let both lines wrap, English
                      // under the Arabic, instead of squeezing two columns.
                      <span className="flex-1 min-w-0 space-y-0.5">
                        <span className="block font-arabic text-base font-semibold text-foreground" dir="rtl">
                          {card.wordVoweled || card.word}
                        </span>
                        <span className="block text-sm text-muted-foreground">{card.english || '—'}</span>
                      </span>
                    ) : (
                      <>
                        <span className="font-arabic text-base font-semibold text-foreground flex-1" dir="rtl">
                          {card.word}
                        </span>
                        <span className="text-sm text-muted-foreground truncate max-w-[40%] text-right">
                          {card.english || '—'}
                        </span>
                      </>
                    )}
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border">
        <button
          onClick={() => onStartRelearn(Array.from(selectedIds))}
          disabled={selectedIds.size === 0}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          Start Relearning ({selectedIds.size} card{selectedIds.size !== 1 ? 's' : ''})
        </button>
      </div>
    </div>
  );
};

export default RelearnModal;
