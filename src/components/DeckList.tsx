import { useState } from 'react';
import { FlashCard } from '@/lib/spaced-repetition';
import { Trash2, Pencil, Check, X, ArrowLeft } from 'lucide-react';

interface DeckListProps {
  cards: FlashCard[];
  onDelete: (id: string) => void;
  onUpdateImage: (id: string, imageUrl: string) => void;
  onBack: () => void;
}

const DeckList = ({ cards, onDelete, onUpdateImage, onBack }: DeckListProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState('');

  const startEdit = (card: FlashCard) => {
    setEditingId(card.id);
    setEditUrl(card.imageUrl || '');
  };

  const saveEdit = (id: string) => {
    onUpdateImage(id, editUrl);
    setEditingId(null);
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h2 className="text-xl font-bold text-foreground">My Deck ({cards.length})</h2>

      {cards.length === 0 && (
        <p className="text-muted-foreground text-center py-8">No words in your deck yet.</p>
      )}

      <div className="space-y-2">
        {cards.map((card) => (
          <div
            key={card.id}
            className="rounded-xl bg-card flashcard-shadow border border-border/50 p-4 flex items-center gap-3"
          >
            {/* Thumbnail */}
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
              {card.imageUrl ? (
                <img src={card.imageUrl} alt={card.word} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl">📖</span>
              )}
            </div>

            {/* Word info */}
            <div className="flex-1 min-w-0">
              <p className="font-arabic text-lg font-semibold text-foreground truncate" dir="rtl">
                {card.word}
              </p>
              {editingId === card.id ? (
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="text"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    placeholder="Image URL..."
                    className="text-xs bg-muted rounded px-2 py-1 flex-1 text-foreground"
                  />
                  <button onClick={() => saveEdit(card.id)} className="text-success p-1">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-muted-foreground p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Review: {card.nextReviewDate}
                </p>
              )}
            </div>

            {/* Actions */}
            {editingId !== card.id && (
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => startEdit(card)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(card.id)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DeckList;
