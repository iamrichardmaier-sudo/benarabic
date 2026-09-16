import { useEffect, useRef, useState } from 'react';
import { FileUp, Loader2, Download, ScanText, AudioLines } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { supabase } from '@/integrations/supabase/client';
import { openPdf, extractText, renderPageImage, joinPages, type PdfPage } from '@/lib/pdf-text';
import { chunkForSpeech, estimateSeconds, tidyForSpeech } from '@/lib/tts-chunks';
import { loadVoiceModel, speak, VOICES, DEFAULT_VOICE, canGenerateSpeech } from '@/lib/tts-kokoro';
import { concatSamples, silence, encodeMp3, audioFileName } from '@/lib/mp3';

type Stage = 'pick' | 'reading' | 'review' | 'speaking' | 'done';

/** A pause between chunks, so sentences do not run into each other. */
const JOIN_PAUSE = 0.28;

function minutes(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function reason(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return 'Something went wrong.';
}

/**
 * A PDF in, an MP3 of it read aloud out — done entirely on this device.
 *
 * The browser's own speechSynthesis would have been far less work, but it
 * cannot be recorded into a file and it stops the moment a phone is locked.
 * A generated file has neither problem: it plays like any other track, screen
 * off, with lock-screen controls. The cost is a voice model to download once
 * and generation that runs slower than listening does.
 */
const PdfToAudio = ({ onBack }: { onBack: () => void }) => {
  const [stage, setStage] = useState<Stage>('pick');
  const [fileName, setFileName] = useState('');
  const [pages, setPages] = useState<PdfPage[]>([]);
  const [text, setText] = useState('');
  const [voice, setVoice] = useState(DEFAULT_VOICE);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const cancelled = useRef(false);

  // The blob outlives a render but not the screen; without this every
  // regenerated file would leak until the tab closed.
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Lock-screen controls and a title, which is also what keeps a phone
  // treating this as playback worth continuing in the background.
  useEffect(() => {
    if (!audioUrl || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: fileName.replace(/\.pdf$/i, '') || 'Reading',
      artist: 'Wazn',
    });
  }, [audioUrl, fileName]);

  const scanned = pages.filter((p) => p.needsOcr);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setFileName(file.name);
    setStage('reading');
    setProgress(0);
    try {
      const doc = await openPdf(file);
      const { pages: read } = await extractText(doc, (done, total) => setProgress(done / total));
      setPages(read);
      setText(tidyForSpeech(joinPages(read)));
      setStage('review');
    } catch (err) {
      setError(reason(err));
      setStage('pick');
    }
  };

  /**
   * Read the pages that carry pictures instead of text.
   *
   * Deliberately a separate button: it is the one step that goes off the
   * device, and a reader who only has text PDFs never needs it.
   */
  const readScannedPages = async (file: File) => {
    setError(null);
    setStage('reading');
    setNote('Reading the scanned pages…');
    try {
      const doc = await openPdf(file);
      const updated = [...pages];
      for (let i = 0; i < scanned.length; i++) {
        if (cancelled.current) break;
        const page = scanned[i];
        setProgress(i / scanned.length);
        const image = await renderPageImage(doc, page.number);
        const { data, error: fnError } = await supabase.functions.invoke('read-page-image', {
          body: { image },
        });
        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);
        const at = updated.findIndex((p) => p.number === page.number);
        if (at >= 0) updated[at] = { ...updated[at], text: data.text ?? '', needsOcr: false };
      }
      setPages(updated);
      setText(tidyForSpeech(joinPages(updated)));
      setNote('');
      setStage('review');
    } catch (err) {
      setError(reason(err));
      setNote('');
      setStage('review');
    }
  };

  const generate = async () => {
    const chunks = chunkForSpeech(text);
    if (chunks.length === 0) return;
    cancelled.current = false;
    setError(null);
    setStage('speaking');
    setProgress(0);
    setNote('Loading the voice…');

    try {
      await loadVoiceModel((fraction) => {
        setNote(`Downloading the voice, ${Math.round(fraction * 100)}%`);
      });
      setNote('');

      const parts: Float32Array[] = [];
      let rate = 24000;
      for (let i = 0; i < chunks.length; i++) {
        if (cancelled.current) {
          setStage('review');
          return;
        }
        const spoken = await speak(chunks[i], voice);
        rate = spoken.sampleRate;
        parts.push(spoken.samples);
        if (i < chunks.length - 1) parts.push(silence(JOIN_PAUSE, rate));
        // Nine tenths of the bar is speaking; encoding is the last tenth.
        setProgress(((i + 1) / chunks.length) * 0.9);
      }

      setNote('Encoding the MP3…');
      const blob = await encodeMp3(concatSamples(parts), rate, (f) => setProgress(0.9 + f * 0.1));
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(blob));
      setNote('');
      setStage('done');
    } catch (err) {
      setError(reason(err));
      setNote('');
      setStage('review');
    }
  };

  const spokenSeconds = estimateSeconds(text);

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} label="Settings" />

      <div className="space-y-1">
        <h2 className="text-xl font-bold text-foreground">PDF to audio</h2>
        <p className="text-sm text-muted-foreground">
          Turn an English PDF into an MP3 you can listen to anywhere. The voice runs on this
          device — nothing is sent to a speech service, and there is nothing to pay.
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {stage === 'pick' && (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center transition-colors hover:bg-muted/40">
          <FileUp className="h-8 w-8 text-primary" />
          <span className="font-semibold text-foreground">Choose a PDF</span>
          <span className="text-xs text-muted-foreground">
            Scanned pages work too — they are read separately.
          </span>
          <input
            type="file"
            accept="application/pdf"
            aria-label="Choose a PDF"
            className="sr-only"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </label>
      )}

      {(stage === 'reading' || stage === 'speaking') && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-6 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">
            {note || (stage === 'reading' ? 'Reading the PDF…' : 'Reading it aloud…')}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          {stage === 'speaking' && (
            <p className="text-xs text-muted-foreground">
              This runs slower than listening does, and it keeps going while the screen is on.
              A long document is worth starting on a computer.
            </p>
          )}
          {stage === 'speaking' && (
            <button
              onClick={() => {
                cancelled.current = true;
              }}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Stop
            </button>
          )}
        </div>
      )}

      {stage === 'review' && (
        <div className="space-y-3">
          {scanned.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
              <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <ScanText className="h-4 w-4 text-primary" />
                {scanned.length} page{scanned.length === 1 ? '' : 's'} carry no text
              </p>
              <p className="text-xs text-muted-foreground">
                They are pictures of text, so they have to be looked at rather than read. This is
                the one step that leaves the device: it uses the Anthropic key the app already has
                for tagging, at a fraction of a penny per page. Skip it and those pages are left out.
              </p>
              <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground transition-all active:scale-95">
                <ScanText className="h-4 w-4" />
                Read the scanned pages
                <input
                  type="file"
                  accept="application/pdf"
                  aria-label="Read the scanned pages"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) readScannedPages(f);
                  }}
                />
              </label>
              <p className="text-[11px] text-muted-foreground">
                Pick the same PDF again — the browser does not let a page keep a file open.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <label htmlFor="pdf-text" className="text-sm font-medium text-foreground">
                What will be read
              </label>
              <span className="text-xs text-muted-foreground">
                {text.split(/\s+/).filter(Boolean).length.toLocaleString()} words · about{' '}
                {minutes(spokenSeconds)}
              </span>
            </div>
            <textarea
              id="pdf-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-[11px] text-muted-foreground">
              Trim the references, the headers, anything you would skip. Whatever is left is what
              gets read.
            </p>
          </div>

          <div className="space-y-1">
            <label htmlFor="pdf-voice" className="text-sm font-medium text-foreground">
              Voice
            </label>
            <select
              id="pdf-voice"
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={generate}
            disabled={!text.trim() || !canGenerateSpeech()}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-all active:scale-95 disabled:opacity-40"
          >
            <AudioLines className="h-4 w-4" />
            Read it aloud
          </button>
          <p className="text-[11px] text-center text-muted-foreground">
            The voice downloads once, the first time. After that it is instant to start.
          </p>
        </div>
      )}

      {stage === 'done' && audioUrl && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">Ready — {minutes(spokenSeconds)}</p>
          <audio ref={audioRef} src={audioUrl} controls className="w-full" />
          <a
            href={audioUrl}
            download={audioFileName(fileName)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-all active:scale-95"
          >
            <Download className="h-4 w-4" />
            Save the MP3
          </a>
          <p className="text-[11px] text-muted-foreground">
            Playing it here keeps going with the screen off, and the lock screen gets the
            controls. Saving it puts it anywhere you keep music.
          </p>
          <button
            onClick={() => setStage('review')}
            className="w-full text-xs text-muted-foreground underline hover:text-foreground"
          >
            Change the text or the voice
          </button>
        </div>
      )}
    </div>
  );
};

export default PdfToAudio;
