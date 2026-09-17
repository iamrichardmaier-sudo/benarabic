import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { looksLikeJson } from '@/lib/import-tagged';
import BackButton from '@/components/BackButton';

interface AddWordsProps {
  onAdd: (lines: string[], chapter: string) => void;
  /** Omitted when this is a top-level screen with nowhere to go back to. */
  onBack?: () => void;
  isLoading?: boolean;
  /** Existing chapter names, for the autocomplete list. */
  chapters?: string[];
}

const AddWords = ({ onAdd, isLoading, chapters = [], onBack }: AddWordsProps) => {
  const [text, setText] = useState('');
  const [chapter, setChapter] = useState('');
  const [error, setError] = useState('');

  const handleAdd = () => {
    setError('');

    if (looksLikeJson(text)) {
      setError('That looks like JSON — import it from Settings → Import words.');
      return;
    }

    const lines = text
      .split('\n')
      .map((w) => w.trim())
      .filter((w) => w.length > 0);

    if (lines.length === 0) return;

    const invalid = lines.filter((l) => !l.includes('|'));
    if (invalid.length > 0) {
      setError(`Please use format: Arabic | English. ${invalid.length} line${invalid.length > 1 ? 's' : ''} missing "|" separator.`);
      return;
    }

    onAdd(lines, chapter.trim());
    setText('');
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {onBack && <BackButton onClick={onBack} label="Settings" />}
          <div className="rounded-xl bg-muted/50 border border-border/50 p-3 text-xs text-muted-foreground space-y-1.5">
            <p className="font-medium text-foreground text-sm">Paste words in format: Fusha/Shaami | English (one per line)</p>
            <p className="font-arabic" dir="rtl">فِطِر / فَطَرَ | to eat breakfast</p>
            <p className="font-arabic" dir="rtl">مُفَضَّل/ة | favorite</p>
            <p className="font-arabic" dir="rtl">نادي ج. نَوادي | club</p>
            <p className="text-[11px] leading-snug">
              "/" splits Fusha and Shaami, unless followed by ة (marks masc/fem). "ج." before a word marks it as the plural — it becomes its own card.
            </p>
          </div>
          <Textarea
            dir="rtl"
            className="min-h-[160px] font-arabic text-lg bg-card border-border resize-none focus:ring-2 focus:ring-primary/30"
            placeholder="فِطِر / فَطَرَ | to eat breakfast&#10;مُفَضَّل/ة | favorite"
            value={text}
            onChange={(e) => { setText(e.target.value); setError(''); }}
            disabled={isLoading}
          />
          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}
          <div className="space-y-1.5">
            <label htmlFor="add-words-chapter" className="text-sm font-medium text-muted-foreground">
              Chapter (optional)
            </label>
            <input
              id="add-words-chapter"
              list="add-words-chapter-options"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="e.g. Chapter 13"
              disabled={isLoading}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <datalist id="add-words-chapter-options">
              {chapters.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <Button onClick={handleAdd} className="w-full gap-2" size="lg" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Fetching images...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add Words
              </>
            )}
          </Button>
    </div>
  );
};

export default AddWords;
