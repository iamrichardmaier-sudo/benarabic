import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';

interface AddWordsProps {
  onAdd: (lines: string[]) => void;
  isLoading?: boolean;
}

const AddWords = ({ onAdd, isLoading }: AddWordsProps) => {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

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

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <div className="rounded-xl bg-muted/50 border border-border/50 p-3 text-xs text-muted-foreground space-y-1.5">
        <p className="font-medium text-foreground text-sm">Paste words in format: Arabic | English (one per line)</p>
        <p className="font-arabic" dir="rtl">كِتَاب | book</p>
        <p className="font-arabic" dir="rtl">مَدْرَسَة | school</p>
        <p className="font-arabic" dir="rtl">بَاب | door</p>
      </div>
      <Textarea
        dir="rtl"
        className="min-h-[160px] font-arabic text-lg bg-card border-border resize-none focus:ring-2 focus:ring-primary/30"
        placeholder="كِتَاب | book&#10;مَدْرَسَة | school"
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
    </div>
  );
};

export default AddWords;
