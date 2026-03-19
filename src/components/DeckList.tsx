import { useState } from 'react';
import { FlashCard } from '@/lib/spaced-repetition';
import { Trash2, Pencil, Check, X, ArrowLeft, RefreshCw, Loader2, ArrowLeftRight, FileDown } from 'lucide-react';
import SpeakButton from '@/components/SpeakButton';
import { searchUnsplashImage } from '@/lib/unsplash';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { registerAmiriFont } from '@/lib/amiri-font';

interface DeckListProps {
  cards: FlashCard[];
  onDelete: (id: string) => void;
  onUpdateCard: (id: string, updates: Partial<Pick<FlashCard, 'imageUrl' | 'english' | 'word'>>) => void;
  onBack: () => void;
}

function getCardColor(card: FlashCard): string | undefined {
  const isGreen = card.easeFactor >= 2.5 && card.stage2Attempts >= 3 && card.intervalDays >= 7;
  if (isGreen) return '#e5ffe8';
  const isRed = card.easeFactor < 2.0 || (card.stage2Attempts >= 3 && card.intervalDays <= 1);
  if (isRed) return '#ffe5e5';
  return undefined;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Not scheduled';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

const DeckList = ({ cards, onDelete, onUpdateCard, onBack }: DeckListProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEnglish, setEditEnglish] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [swappedId, setSwappedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
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

  const handleSwap = (card: FlashCard) => {
    onUpdateCard(card.id, { word: card.english || '', english: card.word });
    setSwappedId(card.id);
    setTimeout(() => setSwappedId(null), 2000);
  };

  const exportPDF = async () => {
    if (cards.length === 0) {
      alert('Your deck is empty — nothing to export.');
      return;
    }

    setExporting(true);
    try {
      const doc = new jsPDF();
      await registerAmiriFont(doc);

      const today = new Date();
      const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const fileDate = today.toISOString().split('T')[0];

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('My Arabic Flashcard Deck', 14, 20);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(128, 128, 128);
      doc.text(`Exported on ${dateStr}`, 14, 28);
      doc.setTextColor(0, 0, 0);

      const tableData = cards.map((card, i) => [
        String(i + 1),
        card.word,
        card.english || '',
        String(card.stage2Attempts),
        formatDate(card.nextReviewDate),
      ]);

      autoTable(doc, {
        startY: 35,
        head: [['#', 'Arabic Word', 'English Translation', 'Times Reviewed', 'Next Review']],
        body: tableData,
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          1: { halign: 'right', font: 'Amiri' },
        },
        alternateRowStyles: { fillColor: [249, 249, 249] },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 1) {
            data.cell.styles.font = 'Amiri';
          }
          if (data.section === 'body') {
            const card = cards[data.row.index];
            if (card) {
              const color = getCardColor(card);
              if (color === '#e5ffe8') {
                data.cell.styles.fillColor = [229, 255, 232];
              } else if (color === '#ffe5e5') {
                data.cell.styles.fillColor = [255, 229, 229];
              }
            }
          }
        },
      });

      doc.save(`arabic-flashcards-${fileDate}.pdf`);
    } catch {
      toast({ title: 'Failed to generate PDF', variant: 'destructive' });
    } finally {
      setExporting(false);
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

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">My Deck ({cards.length})</h2>
        <button
          onClick={exportPDF}
          disabled={exporting}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors font-medium disabled:opacity-50"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          {exporting ? 'Exporting…' : 'Export PDF'}
        </button>
      </div>

      {cards.length === 0 && (
        <p className="text-muted-foreground text-center py-8">No words in your deck yet.</p>
      )}

      <div className="space-y-2">
        {cards.map((card) => (
          <div
            key={card.id}
            className="rounded-xl bg-card flashcard-shadow border border-border/50 p-4"
            style={{ backgroundColor: getCardColor(card) }}
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
                <div className="flex items-center gap-2">
                  <p className="font-arabic text-lg font-semibold text-foreground truncate" dir="rtl">
                    {card.word}
                  </p>
                  {swappedId === card.id && (
                    <span className="text-xs font-medium text-green-600 animate-in fade-in">Swapped!</span>
                  )}
                </div>
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
                    onClick={() => handleSwap(card)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Swap Arabic/English"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                  </button>
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
