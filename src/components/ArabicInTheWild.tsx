import { useState } from 'react';
import { useLibraryTexts, type LibraryText } from '@/hooks/useLibraryTexts';
import { readAsCover } from '@/lib/cover-image';
import { wordsNeedingTags, tagWords, MAX_WORDS, type TagProgress } from '@/lib/tag-text';
import { skeletonOf } from '@/hooks/useWordSkeletonIndex';
import { fromWordSense, type TaggedSense } from '@/lib/reader-word';
import { Link2, FileText, Loader2, BookmarkPlus, ImagePlus, Languages } from 'lucide-react';
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

/** Remembered, so the choice does not have to be made on every entry. */
const ENGLISH_KEY = 'arabic-flashcards-library-show-english';

function readShowEnglish(): boolean {
  try {
    return localStorage.getItem(ENGLISH_KEY) === 'true';
  } catch {
    return false;
  }
}

interface ArabicInTheWildProps {
  /** Omitted when this is a top-level screen with nowhere to go back to. */
  onBack?: () => void;
  /** A saved entry to open straight into, instead of the paste form. */
  entry?: LibraryText | null;
}

const ArabicInTheWild = ({ onBack, entry = null }: ArabicInTheWildProps) => {
  const { lookup } = useWordSkeletonIndex();
  const { save } = useLibraryTexts();
  const [url, setUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [title, setTitle] = useState(entry?.title ?? '');
  const [content, setContent] = useState(entry?.body ?? '');
  const [cover, setCover] = useState<string | null>(entry?.coverUrl ?? null);
  const [english, setEnglish] = useState(entry?.english ?? '');
  const [showEnglish, setShowEnglish] = useState(readShowEnglish);
  const [article, setArticle] = useState<FetchedArticle | null>(
    entry ? { title: entry.title, content: entry.body } : null,
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!entry);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [progress, setProgress] = useState<TagProgress | null>(null);
  // Senses for this entry's own words, which the shared scripture index does
  // not have — colloquial vocabulary above all.
  const [wordTags, setWordTags] = useState<Record<string, TaggedSense[]>>(entry?.wordTags ?? {});

  /**
   * The words of this text that nothing explains yet.
   *
   * Recomputed rather than stored: the shared index arrives asynchronously, so
   * a count taken once would be wrong on the first render.
   */
  const stillUntagged = article
    ? wordsNeedingTags(
        article.content,
        (skeleton) => !!wordTags[skeleton] || (lookup(skeleton)?.length ?? 0) > 0,
      ).length
    : 0;
  const taggedHere = Object.keys(wordTags).length;

  /**
   * One line of the text, every word of it hoverable.
   *
   * Tags are read by consonant skeleton, which is the key they were stored
   * under; reading them back by the bare word off the page found nothing,
   * however many were there. The entry's own tags come first, since they were
   * made from this text and beat a skeleton match borrowed from scripture.
   */
  const renderLine = (line: string) =>
    tokenize(line).map((token, i) => {
      if (!token.isWord) return <span key={i}>{token.text}</span>;
      const word = lookupKey(token.text);
      if (!word) return <span key={i}>{token.text}</span>;
      const senses: TaggedSense[] =
        wordTags[skeletonOf(word)] ?? (lookup(word) ?? []).map(fromWordSense);
      // Every word is hoverable, tagged or not: a word nothing is known about
      // is the one worth stopping on, and the panel can still offer to learn it.
      return <WildWordPopover key={i} text={token.text} word={word} senses={senses} />;
    });

  const toggleEnglish = () => {
    setShowEnglish((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(ENGLISH_KEY, String(next));
      } catch {
        /* the preference just will not persist */
      }
      return next;
    });
  };

  const pickCover = async (file: File | undefined) => {
    if (!file) return;
    try {
      setCover(await readAsCover(file));
      setSaved(false);
    } catch (err) {
      setSaveError(errorReason(err));
    }
  };

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Tag first, so what gets stored is the text and its words together.
      // Words the shared index already explains are left to it; the rest are
      // this text's own, and they travel with it.
      const needed = wordsNeedingTags(
        content,
        (skeleton) => !!wordTags[skeleton] || (lookup(skeleton)?.length ?? 0) > 0,
      );
      const fresh = needed.length > 0 ? await tagWords(needed, setProgress) : {};
      const merged = { ...wordTags, ...fresh };
      setWordTags(merged);
      await save({
        id: entry?.id,
        title: title.trim() || 'Untitled',
        body: content,
        english,
        coverUrl: cover,
        wordTags: merged,
      });
      setSaved(true);
    } catch (err) {
      setSaveError(errorReason(err));
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

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
        {entry && onBack ? (
          <BackButton onClick={onBack} label="Library" />
        ) : (
          <BackButton onClick={handleEdit} label="Edit text" />
        )}

        {cover && (
          <img
            src={cover}
            alt=""
            className="mx-auto w-40 max-w-full rounded-2xl border border-border object-cover shadow-sm"
          />
        )}

        {article.title && (
          <h2 className="font-arabic text-xl font-bold text-foreground text-right" dir="rtl">
            {article.title}
          </h2>
        )}

        {(!saved || stillUntagged > 0) && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-primary py-2 text-sm font-semibold text-primary transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
            {saving
              ? progress && progress.total > 0
                ? `Tagging words… ${progress.done} of ${progress.total}`
                : 'Saving…'
              : saved
                // Already in the library, so this is only about the words —
                // and an entry saved before tagging existed needs a way in.
                ? `Tag ${stillUntagged} more word${stillUntagged === 1 ? '' : 's'}`
                : 'Keep this in my library'}
          </button>
        )}

        {saved && !saving && (
          <p className="text-center text-[11px] text-muted-foreground">
            {taggedHere > 0
              ? `${taggedHere} word${taggedHere === 1 ? '' : 's'} tagged from this text.`
              : 'None of this text\u2019s own words are tagged yet.'}
          </p>
        )}
        {saving && progress && progress.total >= MAX_WORDS && (
          <p className="text-center text-[11px] text-muted-foreground">
            Long text — the first {MAX_WORDS} new words are being tagged.
          </p>
        )}
        {saveError && <p className="text-xs text-destructive text-center">{saveError}</p>}

        {english.trim() && (
          <button
            onClick={toggleEnglish}
            aria-pressed={showEnglish}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Languages className="h-4 w-4" />
            {showEnglish ? 'Hide English' : 'Show English'}
          </button>
        )}

        {/* Line by line rather than one block, so each line can be paired with
            its English the way a verse is in the Bible reader. */}
        <div className="space-y-1 rounded-2xl border border-border bg-card p-6">
          {article.content.split('\n').map((line, lineIndex) => {
            const englishLine = english.split('\n')[lineIndex]?.trim() ?? '';
            if (!line.trim()) return <div key={lineIndex} className="h-3" />;
            return (
              <div key={lineIndex} className="space-y-0.5">
                <p className="font-arabic text-lg leading-loose text-foreground text-right" dir="rtl">
                  {renderLine(line)}
                </p>
                {showEnglish && englishLine && (
                  <p className="text-sm leading-snug text-muted-foreground">{englishLine}</p>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground/70 text-center pb-2">
          {taggedHere > 0
            ? 'Meanings come from this text\u2019s own tagging first, then from the scripture word database matched by consonant skeleton. A word without diacritics can have more than one possible reading.'
            : 'Word meanings come from the scripture word database matched by consonant skeleton, since this text has no diacritics \u2014 coverage is partial and a word can show more than one possible reading. Tag this text to fill in the rest.'}
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

        <div className="flex items-center gap-3">
          {cover ? (
            <img src={cover} alt="" className="h-14 w-14 rounded-lg border border-border object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
              <ImagePlus className="h-5 w-5" />
            </div>
          )}
          <label className="flex-1 cursor-pointer text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Cover picture (optional)</span>
            <span className="mt-0.5 block">
              A picture from this device. It is scaled down and kept on your own copy — it is never
              part of the app itself.
            </span>
            <input
              type="file"
              accept="image/*"
              aria-label="Cover picture"
              className="sr-only"
              onChange={(e) => pickCover(e.target.files?.[0])}
            />
          </label>
          {cover && (
            <button
              onClick={() => setCover(null)}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Remove
            </button>
          )}
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste the article text here…"
          dir="rtl"
          rows={10}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-base font-arabic leading-loose focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="space-y-1">
          <label htmlFor="wild-english" className="text-xs font-medium text-foreground">
            English (optional)
          </label>
          <p className="text-[11px] text-muted-foreground">
            One line per line of Arabic above, and a <em>Show English</em> button appears while
            reading. Blank lines line up too, so verses and stanzas stay together.
          </p>
          <textarea
            id="wild-english"
            value={english}
            onChange={(e) => setEnglish(e.target.value)}
            placeholder="Line one&#10;Line two"
            dir="ltr"
            rows={6}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

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
