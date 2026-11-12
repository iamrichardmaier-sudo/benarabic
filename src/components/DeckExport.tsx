import { useMemo, useState } from 'react';
import { Download, FileText, Loader2, Sparkles } from 'lucide-react';
import BackButton from '@/components/BackButton';
import type { FlashCard } from '@/lib/spaced-repetition';
import {
  RANGE_LABEL, RECENT_DAYS, buildMarkdown, downloadFile, exportFilename, selectCards,
  type ExportFormat, type ExportRange,
} from '@/lib/deck-export';

interface DeckExportProps {
  cards: FlashCard[];
  onBack: () => void;
}

const RANGES: { id: ExportRange; title: string; hint: string }[] = [
  { id: 'recent', title: 'Last 2 weeks', hint: `Words added in the last ${RECENT_DAYS} days` },
  { id: 'all', title: 'Entire deck', hint: 'Every word you have' },
];

const FORMATS: { id: ExportFormat; title: string; hint: string; icon: typeof FileText }[] = [
  {
    id: 'pdf',
    title: 'PDF to read',
    hint: 'Clean pages for a person: the Arabic large, with English, forms and verses',
    icon: FileText,
  },
  {
    id: 'markdown',
    title: 'Markdown for AI',
    hint: 'Plain structured text to paste or upload to Claude, ChatGPT or any assistant',
    icon: Sparkles,
  },
];

/**
 * Taking the words out as a document, from Settings.
 *
 * Two choices and a button: which words (the last two weeks, or all of them)
 * and for whom (a PDF to read, or Markdown an AI can take in). The count on
 * the button is the real number that will be in the file.
 */
const DeckExport = ({ cards, onBack }: DeckExportProps) => {
  const [range, setRange] = useState<ExportRange>('recent');
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const counts = useMemo(
    () => ({ recent: selectCards(cards, 'recent').length, all: cards.length }),
    [cards],
  );
  const count = counts[range];

  const run = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    setProgress(null);
    try {
      const now = new Date();
      const picked = selectCards(cards, range, now);
      if (picked.length === 0) return;
      const filename = exportFilename(range, format, now);
      if (format === 'markdown') {
        downloadFile(
          buildMarkdown(picked, { range, count: picked.length, now }),
          filename,
          'text/markdown;charset=utf-8',
        );
      } else {
        // Loaded on demand: the PDF library is big and most visits never need it.
        const { buildDeckPdf } = await import('@/lib/deck-export-pdf');
        const pdf = await buildDeckPdf(picked, {
          range,
          now,
          onProgress: (d, t) => setProgress([d, t]),
        });
        downloadFile(pdf, filename, 'application/pdf');
      }
      setDone(`${picked.length} word${picked.length === 1 ? '' : 's'} saved as ${filename}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The file could not be built.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      <BackButton onClick={onBack} label="Settings" />

      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Export words</h1>
        <p className="text-sm text-muted-foreground">
          Save your words as a document, to read or to give to an AI.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Which words</h2>
        <div role="radiogroup" aria-label="Which words" className="grid gap-2 sm:grid-cols-2">
          {RANGES.map((r) => (
            <Choice
              key={r.id}
              selected={range === r.id}
              onSelect={() => setRange(r.id)}
              title={r.title}
              hint={`${r.hint} (${counts[r.id]})`}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Format</h2>
        <div role="radiogroup" aria-label="Format" className="grid gap-2 sm:grid-cols-2">
          {FORMATS.map((f) => (
            <Choice
              key={f.id}
              selected={format === f.id}
              onSelect={() => setFormat(f.id)}
              title={f.title}
              hint={f.hint}
              icon={f.icon}
            />
          ))}
        </div>
      </section>

      <div className="space-y-3">
        <button
          onClick={run}
          disabled={busy || count === 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {busy
            ? progress
              ? `Building… ${progress[0]} of ${progress[1]}`
              : 'Building…'
            : `Download ${count} word${count === 1 ? '' : 's'} (${format === 'pdf' ? 'PDF' : 'Markdown'})`}
        </button>

        {count === 0 && (
          <p className="text-sm text-muted-foreground">
            {range === 'recent'
              ? `No words were added in the last ${RECENT_DAYS} days. Choose “Entire deck” to export everything.`
              : 'Your deck is empty, so there is nothing to export.'}
          </p>
        )}
        {done && <p role="status" className="text-sm text-foreground">{done}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">
          Exporting {RANGE_LABEL[range]}. The file is built on this device and nothing is uploaded.
        </p>
      </div>
    </div>
  );
};

interface ChoiceProps {
  selected: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
  icon?: typeof FileText;
}

const Choice = ({ selected, onSelect, title, hint, icon: Icon }: ChoiceProps) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    onClick={onSelect}
    className={`flex items-start gap-3 rounded-2xl border p-4 text-start transition-colors ${
      selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:bg-muted/40'
    }`}
  >
    {Icon && <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />}
    <span className="min-w-0">
      <span className="block font-semibold text-foreground">{title}</span>
      <span className="block text-xs text-muted-foreground">{hint}</span>
    </span>
  </button>
);

export default DeckExport;
