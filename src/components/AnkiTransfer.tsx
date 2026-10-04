import { useMemo, useRef, useState } from 'react';
import { Download, FileDown, FileUp, Loader2 } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { useAuth } from '@/hooks/useAuth';
import { useDeckLibrary } from '@/hooks/useDeckLibrary';
import { importIntoNewDeck, nextAddedWordsTitle } from '@/lib/added-words';
import type { FlashCard } from '@/lib/spaced-repetition';
import {
  AnkiImportError, MAPPING_LABELS, guessMapping, planImport, readAnkiFile,
  type AnkiSource, type FieldMapping,
} from '@/lib/anki/import';
import { cleanField } from '@/lib/anki/text';

interface AnkiTransferProps {
  cards: FlashCard[];
  onBack: () => void;
  /** Called after words are saved, so the deck on screen catches up. */
  onImported: () => unknown;
}

function download(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

/**
 * Moving a deck between Wazn and Anki, in both directions, from Settings.
 *
 * Export is the half that earns trust: your words, your verses and your
 * schedule leave in a file you can open elsewhere, no account involved. Import
 * shows what it understood before saving anything.
 */
const AnkiTransfer = ({ cards, onBack, onImported }: AnkiTransferProps) => {
  const { user } = useAuth();
  const { decks, refresh } = useDeckLibrary();
  const fileInput = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [sources, setSources] = useState<AnkiSource[] | null>(null);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [mapping, setMapping] = useState<FieldMapping | null>(null);

  const source = sources?.[sourceIndex] ?? null;
  const plan = useMemo(
    () => (source && mapping && mapping.arabic !== null ? planImport(source, mapping, cards) : null),
    [source, mapping, cards],
  );
  const mine = decks.filter((d) => d.createdBy === user?.id);

  const exportApkg = async () => {
    setBusy('apkg');
    setError(null);
    try {
      const { buildApkg } = await import('@/lib/anki/export');
      download(await buildApkg(cards), `wazn-${stamp()}.apkg`, 'application/octet-stream');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The export could not be built.');
    } finally {
      setBusy(null);
    }
  };

  const exportText = async () => {
    setError(null);
    const { buildAnkiText } = await import('@/lib/anki/export');
    download(buildAnkiText(cards), `wazn-${stamp()}.txt`, 'text/plain;charset=utf-8');
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setDone(null);
    setSources(null);
    setBusy('read');
    try {
      const found = await readAnkiFile(new Uint8Array(await file.arrayBuffer()));
      setSources(found);
      setSourceIndex(0);
      setMapping(guessMapping(found[0]));
    } catch (err) {
      setError(
        err instanceof AnkiImportError ? err.message : 'That file could not be read as an Anki deck.',
      );
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const chooseSource = (i: number) => {
    setSourceIndex(i);
    setMapping(guessMapping(sources![i]));
  };

  const commit = async () => {
    if (!plan || plan.entries.length === 0 || !user) return;
    setBusy('save');
    setError(null);
    try {
      const { deck, words } = await importIntoNewDeck(
        plan.entries,
        user.id,
        mine.map((d) => d.title),
        decks.map((d) => d.icon),
      );
      setDone(`${words} word${words === 1 ? '' : 's'} added to “${deck.title}”.`);
      setSources(null);
      setMapping(null);
      await refresh();
      await onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The import could not be saved.');
    } finally {
      setBusy(null);
    }
  };

  const preview = plan?.entries.slice(0, 5) ?? [];

  return (
    <div className="space-y-6">
      <BackButton onClick={onBack} label="Settings" />

      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Anki</h1>
        <p className="text-sm text-muted-foreground">
          Take your deck out, or bring one in. Nothing here needs an account beyond this one.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Export your deck
        </h2>
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            {cards.length} word{cards.length === 1 ? '' : 's'}, with their roots, forms and Qur’an
            references. The Anki package also carries your schedule for words you have graduated.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportApkg}
              disabled={cards.length === 0 || busy !== null}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy === 'apkg' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Anki package (.apkg)
            </button>
            <button
              onClick={exportText}
              disabled={cards.length === 0 || busy !== null}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground disabled:opacity-50"
            >
              <FileDown className="h-4 w-4" />
              Plain text
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Import a deck
        </h2>
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Choose an .apkg, or a “Notes in Plain Text” file exported from Anki. The words come in as
            a new deck; review history from the other app is not carried over.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept=".apkg,.txt,.tsv,.csv,text/plain,text/csv,text/tab-separated-values"
            className="sr-only"
            aria-label="Choose an Anki file"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <button
            onClick={() => fileInput.current?.click()}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-xl border border-primary px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-50"
          >
            {busy === 'read' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            Choose a file
          </button>

          {source && mapping && (
            <div className="space-y-3 border-t border-border pt-3">
              {sources && sources.length > 1 && (
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-semibold text-muted-foreground">Note type</span>
                  <select
                    value={sourceIndex}
                    onChange={(e) => chooseSource(Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  >
                    {sources.map((s, i) => (
                      <option key={`${s.label}-${i}`} value={i}>
                        {s.label} ({s.rows.length})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                {MAPPING_LABELS.map(({ key, label, required }) => (
                  <label key={key} className="block text-sm">
                    <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
                    <select
                      value={mapping[key] ?? ''}
                      onChange={(e) =>
                        setMapping({ ...mapping, [key]: e.target.value === '' ? null : Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2"
                      aria-label={label}
                    >
                      {!required && <option value="">— none —</option>}
                      {required && mapping[key] === null && <option value="">Choose a field</option>}
                      {source.columns.map((name, i) => (
                        <option key={i} value={i}>
                          {name}
                          {source.rows[0]?.[i] ? ` — ${cleanField(source.rows[0][i]).slice(0, 24)}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              {plan ? (
                <div className="space-y-2">
                  <p className="text-sm text-foreground">
                    <strong>{plan.entries.length}</strong> new word{plan.entries.length === 1 ? '' : 's'}
                    {plan.duplicates > 0 && ` · ${plan.duplicates} already in your deck, skipped`}
                    {plan.unreadable > 0 && ` · ${plan.unreadable} without Arabic text, skipped`}
                  </p>
                  {preview.length > 0 && (
                    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                      {preview.map((e, i) => (
                        <li key={i} className="flex items-baseline justify-between gap-3 px-3 py-2">
                          <span className="text-xs text-muted-foreground">{e.english || '—'}</span>
                          <span className="font-arabic text-lg" dir="rtl">{e.fusha}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    onClick={commit}
                    disabled={plan.entries.length === 0 || busy !== null}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />}
                    Add {plan.entries.length} word{plan.entries.length === 1 ? '' : 's'} as a new deck
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Choose which field holds the Arabic word.</p>
              )}
            </div>
          )}
        </div>
      </section>

      {done && (
        <p role="status" className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
          {done}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
};

export default AnkiTransfer;
