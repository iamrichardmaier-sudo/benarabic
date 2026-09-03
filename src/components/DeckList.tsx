import { useMemo, useState } from 'react';
import { FlashCard } from '@/lib/spaced-repetition';
import { Trash2, Pencil, Check, X, ArrowLeft, RefreshCw, Loader2, ArrowLeftRight, FileDown, Search } from 'lucide-react';
import SpeakButton from '@/components/SpeakButton';
import WordDetail from '@/components/WordDetail';
import { searchDeck } from '@/lib/deck-search';
import { hasWordDetail } from '@/lib/word-relations';
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
  // The word whose detail the side panel is showing. Set by hover on a
  // pointer, and by tapping the row where there is no hover to have.
  const [previewId, setPreviewId] = useState<string | null>(null);
  const { toast } = useToast();

  const visible = useMemo(() => searchDeck(cards, query), [cards, query]);
  const preview = visible.find((c) => c.id === previewId) ?? null;

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

      <div className="flex items-center justify-between">
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

      {/* Sticky so it follows the list down: a deck of several hundred words is
          a long scroll, and having to go back to the top to search is the
          thing that stops anyone searching. */}
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
        <p className="py-8 text-center text-muted-foreground">
          Nothing matches “{query}”.
        </p>
      )}

      <div className="lg:flex lg:items-start lg:gap-5">
      <div className="space-y-2 lg:min-w-0 lg:flex-1">
        {visible.map((card) => (
          <div
            key={card.id}
            onMouseEnter={() => setPreviewId(card.id)}
            onFocus={() => setPreviewId(card.id)}
            className={`rounded-xl bg-card flashcard-shadow border p-4 transition-colors ${
              previewId === card.id ? 'border-primary/60' : 'border-border/50'
            }`}
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
                  <SpeakButton word={card.word} size={16} />
                  {swappedId === card.id && (
                    <span className="text-xs font-medium text-green-600 animate-in fade-in">Swapped!</span>
                  )}
                </div>
                {card.english && (
                  <p className="text-sm text-muted-foreground truncate">{card.english}</p>
                )}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  {card.root && (
                    <span className="font-arabic text-[13px] font-semibold text-primary" dir="rtl">
                      {card.root}
                    </span>
                  )}
                  {card.verbForm && <span className="font-medium text-primary/80">Form {card.verbForm}</span>}
                  <span>Review: {card.nextReviewDate}</span>
                </div>
                {hasWordDetail(card) && (
                  <button
                    onClick={() => setPreviewId(previewId === card.id ? null : card.id)}
                    aria-expanded={previewId === card.id}
                    className="mt-1 text-xs font-medium text-primary lg:hidden"
                  >
                    {previewId === card.id ? 'Hide forms' : 'Roots & forms'}
                  </button>
                )}
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

            {/* Below lg there is no room for a side panel and no hover to
                drive it, so the detail opens inline under the row instead. */}
            {previewId === card.id && hasWordDetail(card) && (
              <div className="mt-3 border-t border-border/50 pt-3 lg:hidden">
                <WordDetail card={card} deck={cards} />
              </div>
            )}
          </div>
        ))}
      </div>

        {/* The side panel. Sticky, so it stays beside the row being pointed at
            however far down the deck the scroll has gone. */}
        <aside className="hidden lg:block lg:w-80 lg:shrink-0">
          <div className="sticky top-16 rounded-2xl border border-border bg-card p-4 flashcard-shadow">
            {preview ? (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <p className="font-arabic text-2xl font-bold text-foreground" dir="rtl">
                    {preview.wordVoweled || preview.word}
                  </p>
                  <SpeakButton word={preview.wordVoweled || preview.word} size={18} />
                </div>
                {preview.english && (
                  <p className="mb-2 text-sm text-muted-foreground">{preview.english}</p>
                )}
                <WordDetail card={preview} deck={cards} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Point at a word to see its root, its forms and the other words built on it.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default DeckList;
