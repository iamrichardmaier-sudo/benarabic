import { useMemo, useState } from 'react';
import { FlashCard } from '@/lib/spaced-repetition';
import { ArrowLeft, Loader2, FileDown, Search } from 'lucide-react';
import DeckCard from '@/components/DeckCard';
import { searchDeck } from '@/lib/deck-search';
import { isoDay } from '@/lib/day';
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
  const [query, setQuery] = useState('');
  // Only one card is turned over at a time: two open backs in a grid look like
  // a bug rather than a choice, and there is nothing to compare between them.
  const [flippedId, setFlippedId] = useState<string | null>(null);
  const { toast } = useToast();

  const visible = useMemo(() => searchDeck(cards, query), [cards, query]);
  const editing = cards.find((c) => c.id === editingId) ?? null;

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
      const fileDate = isoDay(today);

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('My Arabic Flashcard Deck', 14, 20);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(128, 128, 128);
      doc.text(`Exported on ${dateStr}`, 14, 28);
      doc.setTextColor(0, 0, 0);

      const tableData = visible.map((card, i) => [
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
    <div className="w-full max-w-md lg:max-w-5xl mx-auto space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-foreground">
          My Deck ({query ? `${visible.length} of ${cards.length}` : cards.length})
        </h2>
        <button
          onClick={exportPDF}
          disabled={exporting}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors font-medium disabled:opacity-50"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          {exporting ? 'Exporting…' : 'Export PDF'}
        </button>
      </div>

      {/* Sticky so it follows the grid down: a deck of several hundred words is
          a long scroll, and having to go back to the top to search is the thing
          that stops anyone searching. */}
      <div className="sticky top-0 z-10 -mx-1 bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your deck — English or Arabic"
            aria-label="Search your deck"
            className="w-full rounded-full border border-border bg-card py-2 ps-9 pe-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {cards.length === 0 && (
        <p className="text-muted-foreground text-center py-8">No words in your deck yet.</p>
      )}

      {cards.length > 0 && visible.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">Nothing matches “{query}”.</p>
      )}

      {/* Editing happens in a panel above the grid rather than inside a card:
          a text field on the back of a card that is mid-rotation is a fight
          with the animation, and the field would be clipped by the tile. */}
      {editing && (
        <div className="space-y-2 rounded-2xl border border-primary/40 bg-card p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            Editing
            <span className="font-arabic text-lg" dir="rtl">{editing.word}</span>
          </p>
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="edit-english">
              English translation
            </label>
            <input
              id="edit-english"
              type="text"
              value={editEnglish}
              onChange={(e) => setEditEnglish(e.target.value)}
              placeholder="e.g. book"
              className="mt-1 w-full rounded-lg bg-muted px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="edit-image">
              Image URL
            </label>
            <input
              id="edit-image"
              type="text"
              value={editImageUrl}
              onChange={(e) => setEditImageUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1 w-full rounded-lg bg-muted px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditingId(null)}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={() => saveEdit(editing.id)}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((card) => (
          <DeckCard
            key={card.id}
            card={card}
            deck={cards}
            flipped={flippedId === card.id}
            onFlip={() => setFlippedId(flippedId === card.id ? null : card.id)}
            onDelete={() => onDelete(card.id)}
            onSwap={() => handleSwap(card)}
            onRefreshImage={() => refreshImage(card)}
            onEdit={() => startEdit(card)}
            refreshing={refreshingId === card.id}
            swapped={swappedId === card.id}
          />
        ))}
      </div>
    </div>
  );
};

export default DeckList;
