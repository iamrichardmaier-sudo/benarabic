import { useState } from 'react';
import { Link2, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import BackButton from '@/components/BackButton';
import { useWordSkeletonIndex } from '@/hooks/useWordSkeletonIndex';
import { tokenize } from '@/lib/transcript-mask';
import WildWordPopover from '@/components/WildWordPopover';

// Same idea as the Bible reader's EDGE_PUNCTUATION, extended with the extra
// marks that show up in scraped news text (dashes, brackets, an ellipsis).
const EDGE_PUNCTUATION = /^[.,،؛:؟!"'«»()[\]{}\-–—…]+|[.,،؛:؟!"'«»()[\]{}\-–—…]+$/g;

function lookupKey(word: string): string {
  return word.replace(EDGE_PUNCTUATION, '');
}

/** Supabase (and this function's own JSON error body) surface errors as
 * plain objects, not Error instances — read .message off either. */
function errorReason(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return 'Could not fetch that article.';
}

interface FetchedArticle {
  title: string;
  content: string;
}

interface ArabicInTheWildProps {
  /** Omitted when this is a top-level screen with nowhere to go back to. */
  onBack?: () => void;
}

const ArabicInTheWild = ({ onBack }: ArabicInTheWildProps) => {
  const { lookup } = useWordSkeletonIndex();
  const [url, setUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [article, setArticle] = useState<FetchedArticle | null>(null);

  const handleFetchUrl = async () => {
    if (!url.trim()) return;
    setFetching(true);
    setFetchError(null);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-article', { body: { url: url.trim() } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTitle(data.title || '');
      setContent(data.content || '');
    } catch (err) {
      setFetchError(errorReason(err));
    } finally {
      setFetching(false);
    }
  };

  const handleShow = () => {
    if (!content.trim()) return;
    setArticle({ title: title.trim(), content });
  };

  const handleEdit = () => {
    setArticle(null);
  };

  if (article) {
    return (
      <div className="space-y-4">
        <BackButton onClick={handleEdit} label="Edit text" />

        {article.title && (
          <h2 className="font-arabic text-xl font-bold text-foreground text-right" dir="rtl">
            {article.title}
          </h2>
        )}

        <div className="rounded-2xl border border-border bg-card p-6">
          <p
            className="font-arabic text-lg leading-loose text-foreground text-right"
            dir="rtl"
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {tokenize(article.content).map((token, i) => {
              if (!token.isWord) return <span key={i}>{token.text}</span>;
              const key = lookupKey(token.text);
              const senses = key ? lookup(key) : null;
              if (!senses || senses.length === 0) return <span key={i}>{token.text}</span>;
              return <WildWordPopover key={i} text={token.text} senses={senses} />;
            })}
          </p>
        </div>

        <p className="text-[11px] text-muted-foreground/70 text-center pb-2">
          Word meanings come from the Bible word-tagging database matched by consonant skeleton, since
          this text has no diacritics — coverage is partial and a word can show more than one possible
          reading.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {onBack && <BackButton onClick={onBack} label="Library" />}
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-foreground">Arabic in the Wild</h2>
        <p className="text-sm text-muted-foreground">
          Paste a news article (or fetch one from a link), and hover or tap any word for its root,
          form, and meaning.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <label htmlFor="wild-url" className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Link2 className="w-4 h-4 text-primary" />
          Fetch from a link
        </label>
        <div className="flex gap-2">
          <input
            id="wild-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.bbc.com/arabic/articles/..."
            dir="ltr"
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={handleFetchUrl}
            disabled={!url.trim() || fetching}
            className="flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold transition-all active:scale-95 disabled:opacity-40"
          >
            {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            {fetching ? 'Fetching…' : 'Fetch'}
          </button>
        </div>
        {fetchError && (
          <p className="text-xs text-destructive">
            {fetchError} You can still paste the article text in below.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <FileText className="w-4 h-4 text-primary" />
          Or paste the article yourself
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          dir="rtl"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-arabic focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste the article text here…"
          dir="rtl"
          rows={10}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-base font-arabic leading-loose focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          onClick={handleShow}
          disabled={!content.trim()}
          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95 disabled:opacity-40"
        >
          Show with translations
        </button>
      </div>
    </div>
  );
};

export default ArabicInTheWild;
