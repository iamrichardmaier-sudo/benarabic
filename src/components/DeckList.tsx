import { useEffect, useMemo, useRef, useState } from 'react';
import { FlashCard } from '@/lib/spaced-repetition';
import { Loader2, FileDown, Search, List, LayoutGrid, ChevronDown } from 'lucide-react';
import {
  cardStatus, countByStatus, dueIdSet, filterDeck, sortDeck,
  FILTER_LABELS, SORT_LABELS, type DeckFilter, type DeckSort, type CardStatus,
} from '@/lib/deck-view';
import { dialectView } from '@/lib/dialect';
import { usePreferences } from '@/hooks/usePreferences';
import BackButton from '@/components/BackButton';
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
  /** The screen Back returns to, named on the button. */
  backLabel?: string;
}

const LAYOUT_KEY = 'wazn-deck-layout';
const SORT_KEY = 'wazn-deck-sort';

function readSaved<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* the choice just won't be remembered */
  }
}

// Text stays dark (or white on the solid "Due" pill) so every label clears
// 4.5:1; the colour lives in the outline.
const STATUS_STYLE: Record<CardStatus['key'], string> = {
  due: 'bg-primary text-primary-foreground',
  new: 'border border-info/50 text-foreground',
  learning: 'border border-warning/60 text-foreground',
  known: 'text-muted-foreground',
};

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

const DeckList = ({ cards, onDelete, onUpdateCard, onBack, backLabel = 'Back' }: DeckListProps) => {
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
  const [filter, setFilter] = useState<DeckFilter>('all');
  const [sort, setSort] = useState<DeckSort>(() =>
    readSaved<DeckSort>(SORT_KEY, ['recent', 'az', 'next', 'root'], 'recent'));
  // A list by default: one line per word keeps a deck of hundreds scannable,
  // where the card grid made 145 words about 39,000 pixels of scrolling.
  const [layout, setLayout] = useState<'list' | 'cards'>(() =>
    readSaved<'list' | 'cards'>(LAYOUT_KEY, ['list', 'cards'], 'list'));
  const { dialect } = usePreferences();
  const { toast } = useToast();
  const editPanel = useRef<HTMLDivElement>(null);

  const dueIds = useMemo(() => dueIdSet(cards), [cards]);
  const searched = useMemo(() => searchDeck(cards, query), [cards, query]);
  const counts = useMemo(() => countByStatus(searched, dueIds), [searched, dueIds]);
  const visible = useMemo(
    () => sortDeck(filterDeck(searched, filter, dueIds), sort),
    [searched, filter, dueIds, sort],
  );
  const editing = cards.find((c) => c.id === editingId) ?? null;

  // The edit panel sits above the list; bring it into view when it opens,
  // since the word being edited may be far down.
  useEffect(() => {
    if (editingId) editPanel.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [editingId]);

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
            // Rows follow `visible` (the filtered, sorted list), not `cards`.
            const card = visible[data.row.index];
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

  const renderCard = (card: FlashCard) => (
    <DeckCard
      key={card.id}
      card={card}
      deck={cards}
      flipped={layout === 'list' || flippedId === card.id}
      onFlip={() => setFlippedId(flippedId === card.id ? null : card.id)}
      onDelete={() => onDelete(card.id)}
      onSwap={() => handleSwap(card)}
      onRefreshImage={() => refreshImage(card)}
      onEdit={() => startEdit(card)}
      refreshing={refreshingId === card.id}
      swapped={swappedId === card.id}
    />
  );

  return (
    <div className="w-full max-w-md lg:max-w-5xl mx-auto space-y-4">
      <BackButton label={backLabel} onClick={onBack} />

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-foreground">
          My Deck ({visible.length === cards.length ? cards.length : `${visible.length} of ${cards.length}`})
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

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="flex w-full min-w-0 gap-1.5 overflow-x-auto pb-0.5 sm:w-auto sm:flex-1" role="group" aria-label="Show">
            {(Object.keys(FILTER_LABELS) as DeckFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  filter === f
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                {FILTER_LABELS[f]} <span className="tabular-nums opacity-80">{counts[f]}</span>
              </button>
            ))}
          </div>
          <label className="relative ms-auto shrink-0 sm:ms-0">
            <span className="sr-only">Sort</span>
            <select
              value={sort}
              onChange={(e) => { const v = e.target.value as DeckSort; setSort(v); save(SORT_KEY, v); }}
              className="appearance-none rounded-full border border-border bg-card py-1 ps-3 pe-7 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {(Object.keys(SORT_LABELS) as DeckSort[]).map((k) => (
                <option key={k} value={k}>{SORT_LABELS[k]}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute end-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          </label>
          <div className="flex shrink-0 rounded-full border border-border bg-card p-0.5" role="group" aria-label="Layout">
            {([['list', List, 'List'], ['cards', LayoutGrid, 'Cards']] as const).map(([value, Icon, label]) => (
              <button
                key={value}
                onClick={() => { setLayout(value); save(LAYOUT_KEY, value); }}
                aria-pressed={layout === value}
                aria-label={label}
                title={label}
                className={`rounded-full p-1.5 transition-colors ${
                  layout === value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {cards.length === 0 && (
        <p className="text-muted-foreground text-center py-8">No words in your deck yet.</p>
      )}

      {cards.length > 0 && visible.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">
          {query ? `Nothing matches “${query}”${filter !== 'all' ? ` in ${FILTER_LABELS[filter]}` : ''}.` : `No ${FILTER_LABELS[filter].toLowerCase()} words right now.`}
        </p>
      )}

      {/* Editing happens in a panel above the grid rather than inside a card:
          a text field on the back of a card that is mid-rotation is a fight
          with the animation, and the field would be clipped by the tile. */}
      {editing && (
        <div ref={editPanel} className="space-y-2 rounded-2xl border border-primary/40 bg-card p-4">
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

      {layout === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((card) => renderCard(card))}
        </div>
      ) : (
        visible.length > 0 && (
          <ul className="overflow-hidden rounded-2xl border border-border bg-card">
            {visible.map((card, i) => {
              const status = cardStatus(card, dueIds);
              const open = flippedId === card.id;
              const view = dialectView(card, dialect);
              return (
                <li key={card.id} className={i > 0 ? 'border-t border-border' : ''}>
                  <button
                    onClick={() => setFlippedId(open ? null : card.id)}
                    aria-expanded={open}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-muted/40 ${open ? 'bg-muted/40' : ''}`}
                  >
                    <span className="font-arabic w-28 shrink-0 truncate text-xl font-semibold leading-relaxed text-foreground" dir="rtl">
                      {view.headline}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground">{card.english || '—'}</span>
                      {(card.root || card.verbForm) && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {card.root && <span className="font-arabic text-[13px]" dir="rtl">{card.root}</span>}
                          {card.root && card.verbForm && ' · '}
                          {card.verbForm && `Form ${card.verbForm}`}
                        </span>
                      )}
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${STATUS_STYLE[status.key]}`}>
                      {status.label}
                    </span>
                  </button>
                  {/* The word's card, already turned over: forms, family and
                      every action (edit, swap, image, delete) in one place. */}
                  {open && <div className="px-3 pb-3">{renderCard(card)}</div>}
                </li>
              );
            })}
          </ul>
        )
      )}
    </div>
  );
};

export default DeckList;
