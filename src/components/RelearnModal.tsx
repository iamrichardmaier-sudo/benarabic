import { useState } from 'react';
import { FlashCard } from '@/lib/spaced-repetition';
import { X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface RelearnModalProps {
  cards: FlashCard[];
  onClose: () => void;
  onStartRelearn: (cardIds: string[]) => void;
}

const RelearnModal = ({ cards, onClose, onStartRelearn }: RelearnModalProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allSelected = cards.length > 0 && selectedIds.size === cards.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cards.map((c) => c.id)));
    }
  };

  const toggleCard = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
      <div className="px-4 py-3 border-b border-border/50">
        <button
          onClick={toggleAll}
          className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {cards.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No cards in your deck.</p>
        ) : (
          <div className="space-y-1">
            {cards.map((card) => (
              <label
                key={card.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={selectedIds.has(card.id)}
                  onCheckedChange={() => toggleCard(card.id)}
                />
                <span className="font-arabic text-base font-semibold text-foreground flex-1" dir="rtl">
                  {card.word}
                </span>
                <span className="text-sm text-muted-foreground truncate max-w-[40%] text-right">
                  {card.english || '—'}
                </span>
              </label>
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
