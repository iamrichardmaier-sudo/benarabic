import { useState } from 'react';
import { FlashCard } from '@/lib/spaced-repetition';
import { Trash2, Pencil, Check, X, ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import { searchUnsplashImage } from '@/lib/unsplash';
import { useToast } from '@/hooks/use-toast';

interface DeckListProps {
  cards: FlashCard[];
  onDelete: (id: string) => void;
  onUpdateCard: (id: string, updates: Partial<Pick<FlashCard, 'imageUrl' | 'english'>>) => void;
  onBack: () => void;
}

const DeckList = ({ cards, onDelete, onUpdateCard, onBack }: DeckListProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEnglish, setEditEnglish] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const { toast } = useToast();

  const startEdit = (card: FlashCard) => {
    setEditingId(card.id);
    setEditEnglish(card.english || '');
    setEditImageUrl(card.imageUrl || '');
  };

  const saveEdit = (id: string) => {
    onUpdateCard(id, {
      english: editEnglish.trim() || null,
      imageUrl: editImageUrl.trim() || null,
    });
    setEditingId(null);
  };

  const refreshImage = async (card: FlashCard) => {
    setRefreshingId(card.id);
    try {
      const query = card.english || card.word;
      const imageUrl = await searchUnsplashImage(query);
      onUpdateCard(card.id, { imageUrl });
      toast({ title: imageUrl ? 'Image updated' : 'No image found' });
    } catch {
      toast({ title: 'Failed to refresh image', variant: 'destructive' });
    } finally {
      setRefreshingId(null);
    }
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
            className="rounded-xl bg-card flashcard-shadow border border-border/50 p-4"
          >
            <div className="flex items-center gap-3">
              {/* Thumbnail */}
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center text-xs text-muted-foreground">
                {card.imageUrl ? (
                  <img src={card.imageUrl} alt={card.word} className="w-full h-full object-cover" />
                ) : (
                  'No img'
                )}
              </div>

              {/* Word info */}
              <div className="flex-1 min-w-0">
                <p className="font-arabic text-lg font-semibold text-foreground truncate" dir="rtl">
                  {card.word}
                </p>
                {card.english && (
                  <p className="text-sm text-muted-foreground truncate">{card.english}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Review: {card.nextReviewDate}
                </p>
              </div>

              {/* Actions */}
              {editingId !== card.id && (
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => refreshImage(card)}
                    disabled={refreshingId === card.id}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                    title="Refresh image"
                  >
                    {refreshingId === card.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </button>
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

            {/* Edit form */}
            {editingId === card.id && (
              <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
                <div>
                  <label className="text-xs text-muted-foreground">English translation</label>
                  <input
                    type="text"
                    value={editEnglish}
                    onChange={(e) => setEditEnglish(e.target.value)}
                    placeholder="e.g. book"
                    className="w-full text-sm bg-muted rounded-lg px-3 py-2 text-foreground mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Image URL</label>
                  <input
                    type="text"
                    value={editImageUrl}
                    onChange={(e) => setEditImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full text-sm bg-muted rounded-lg px-3 py-2 text-foreground mt-1"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted">
                    Cancel
                  </button>
                  <button onClick={() => saveEdit(card.id)} className="px-3 py-1.5 rounded-lg text-sm bg-primary text-primary-foreground font-medium">
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DeckList;
