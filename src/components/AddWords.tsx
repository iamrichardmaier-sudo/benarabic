import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, FileJson } from 'lucide-react';
import { parseTaggedImport, TaggedImportEntry } from '@/lib/import-tagged';

interface AddWordsProps {
  onAdd: (lines: string[]) => void;
  onImport: (entries: TaggedImportEntry[]) => void;
  isLoading?: boolean;
}

type Mode = 'list' | 'json';

const AddWords = ({ onAdd, onImport, isLoading }: AddWordsProps) => {
  const [mode, setMode] = useState<Mode>('list');
  const [text, setText] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState('');
  const [jsonErrors, setJsonErrors] = useState<string[]>([]);

  const handleAdd = () => {
    setError('');
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

    onAdd(lines);
    setText('');
  };

  const handleImport = () => {
    setJsonErrors([]);
    if (!jsonText.trim()) return;

    const { entries, errors } = parseTaggedImport(jsonText);
    if (errors.length > 0) {
      setJsonErrors(errors.slice(0, 6));
      return;
    }

    onImport(entries);
    setJsonText('');
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1">
        <button
          onClick={() => setMode('list')}
          className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
            mode === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Word List
        </button>
        <button
          onClick={() => setMode('json')}
          className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
            mode === 'json' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Import JSON
        </button>
      </div>

      {mode === 'list' && (
        <>
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
        </>
      )}

      {mode === 'json' && (
        <>
          <div className="rounded-xl bg-muted/50 border border-border/50 p-3 text-xs text-muted-foreground space-y-1.5">
            <p className="font-medium text-foreground text-sm">Paste a pre-tagged JSON dataset</p>
            <p className="text-[11px] leading-snug">
              A JSON array where each entry has <code>fusha</code>, <code>english</code>, and optionally{' '}
              <code>shaami</code>, <code>root</code>, <code>wordType</code>, <code>verbForm</code>,{' '}
              <code>wordVoweled</code>, <code>pastTense</code>, <code>presentTense</code>, <code>masdarForm</code>,{' '}
              <code>companionForms</code>, <code>imageQuery</code>. Cards are created fully tagged — no AI call
              needed — and images are fetched automatically.
            </p>
          </div>
          <Textarea
            dir="ltr"
            className="min-h-[160px] font-mono text-xs bg-card border-border resize-none focus:ring-2 focus:ring-primary/30"
            placeholder={'[\n  {"fusha": "كتب", "english": "to write", "root": "ك-ت-ب", "wordType": "verb", ...}\n]'}
            value={jsonText}
            onChange={(e) => { setJsonText(e.target.value); setJsonErrors([]); }}
            disabled={isLoading}
          />
          {jsonErrors.length > 0 && (
            <div className="text-sm text-destructive font-medium space-y-1">
              {jsonErrors.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </div>
          )}
          <Button onClick={handleImport} className="w-full gap-2" size="lg" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <FileJson className="w-4 h-4" />
                Import Tagged Words
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
};

export default AddWords;
