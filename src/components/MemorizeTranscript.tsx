import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, Shuffle, Eye, Plus } from 'lucide-react';
import { useTranscripts, type Transcript } from '@/hooks/useTranscripts';
import { tokenize, shuffledWordOrder, hiddenIndices, maskWord } from '@/lib/transcript-mask';

interface MemorizeTranscriptProps {
  onBack: () => void;
}

const MemorizeTranscript = ({ onBack }: MemorizeTranscriptProps) => {
  const { transcripts, loading, addTranscript } = useTranscripts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [percent, setPercent] = useState(30);
  const [keepFirstLetter, setKeepFirstLetter] = useState(true);
  const [order, setOrder] = useState<number[]>([]);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [saving, setSaving] = useState(false);

  const selected = transcripts.find((t) => t.id === selectedId) ?? null;

  // Pick the first transcript once the list has loaded, so there's something
  // to practise immediately rather than an empty picker-only screen.
  useEffect(() => {
    if (!selectedId && transcripts.length > 0) setSelectedId(transcripts[0].id);
  }, [transcripts, selectedId]);

  const tokens = useMemo(() => (selected ? tokenize(selected.content) : []), [selected]);

  // Each word token's position among words only (nulls for whitespace), so
  // rendering can look up "is this the 7th word" without a mutable counter.
  const wordIndexOf = useMemo(() => {
    let next = 0;
    return tokens.map((t) => (t.isWord ? next++ : null));
  }, [tokens]);

  const wordCount = useMemo(() => tokens.filter((t) => t.isWord).length, [tokens]);

  // A fresh shuffle whenever the transcript changes, so switching passages
  // doesn't carry over which words happened to be hidden in the last one.
  useEffect(() => {
    setOrder(shuffledWordOrder(wordCount));
    setRevealed(new Set());
  }, [selected?.id, wordCount]);

  const hidden = useMemo(() => hiddenIndices(order, percent), [order, percent]);

  const reshuffle = () => {
    setOrder(shuffledWordOrder(wordCount));
    setRevealed(new Set());
  };

  const toggleReveal = (wordIndex: number) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(wordIndex)) next.delete(wordIndex);
      else next.add(wordIndex);
      return next;
    });
  };

  const handleSave = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    setSaving(true);
    try {
      await addTranscript(newTitle.trim(), newSubtitle.trim() || null, newContent);
      setNewTitle('');
      setNewSubtitle('');
      setNewContent('');
      setShowAdd(false);
    } catch (err) {
      console.error('Could not save transcript:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      <h2 className="text-xl font-bold text-foreground">Memorize Transcript</h2>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading transcripts…</p>
      ) : transcripts.length === 0 && !showAdd ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
          <p className="text-foreground font-medium">No transcripts yet.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-4 py-2 font-semibold transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add a transcript
          </button>
        </div>
      ) : (
        <>
          {/* Chapter picker */}
          <div className="flex flex-wrap gap-2">
            {transcripts.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                aria-pressed={t.id === selectedId}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  t.id === selectedId
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.title}
              </button>
            ))}
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>

          {showAdd && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Title, e.g. Chapter 13"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <input
                value={newSubtitle}
                onChange={(e) => setNewSubtitle(e.target.value)}
                placeholder="Subtitle (optional)"
                dir="rtl"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-arabic focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Paste the transcript, exactly as given…"
                dir="rtl"
                rows={6}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-base font-arabic leading-loose focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={handleSave}
                disabled={!newTitle.trim() || !newContent.trim() || saving}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95 disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save transcript'}
              </button>
            </div>
          )}

          {selected && (
            <>
              {/* Controls */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <label htmlFor="hide-percent" className="text-muted-foreground font-medium">
                      Hiding {percent}% of words
                    </label>
                    <button
                      onClick={reshuffle}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      Reshuffle
                    </button>
                  </div>
                  <input
                    id="hide-percent"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={percent}
                    onChange={(e) => setPercent(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keepFirstLetter}
                    onChange={(e) => setKeepFirstLetter(e.target.checked)}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  <span className="text-sm text-foreground">Keep the first letter of hidden words</span>
                </label>
              </div>

              {/* The transcript itself */}
              <div className="rounded-2xl border border-border bg-card p-6">
                {selected.subtitle && (
                  <p className="font-arabic text-lg font-bold text-foreground text-center mb-3" dir="rtl">
                    "{selected.subtitle}"
                  </p>
                )}
                <p
                  className="font-arabic text-xl leading-loose text-foreground text-right"
                  dir="rtl"
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {tokens.map((token, i) => {
                    const idx = wordIndexOf[i];
                    if (idx === null) return <span key={i}>{token.text}</span>;
                    const isHidden = hidden.has(idx) && !revealed.has(idx);
                    if (!isHidden) return <span key={i}>{token.text}</span>;
                    return (
                      <button
                        key={i}
                        onClick={() => toggleReveal(idx)}
                        className="inline text-muted-foreground/70 hover:text-primary underline decoration-dotted underline-offset-4 transition-colors"
                        title="Tap to reveal"
                      >
                        {maskWord(token.text, keepFirstLetter)}
                      </button>
                    );
                  })}
                </p>
              </div>

              {hidden.size > 0 && (
                <button
                  onClick={() => setRevealed(new Set(hidden))}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-secondary text-secondary-foreground font-medium transition-all active:scale-95"
                >
                  <Eye className="w-4 h-4" />
                  Reveal everything
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default MemorizeTranscript;
