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

  const handleAdd = () => {
    const lines = text
      .split('\n')
      .map((w) => w.trim())
      .filter((w) => w.length > 0);
    if (lines.length > 0) {
      onAdd(lines);
      setText('');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <div className="rounded-xl bg-muted/50 border border-border/50 p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground text-sm">Input formats:</p>
        <p dir="rtl" className="font-arabic">كِتَاب</p>
        <p dir="rtl" className="font-arabic">كِتَاب | book</p>
        <p>Add English after a pipe (|) for better image results</p>
      </div>
      <Textarea
        dir="rtl"
        className="min-h-[160px] font-arabic text-lg bg-card border-border resize-none focus:ring-2 focus:ring-primary/30"
        placeholder="أدخل الكلمات هنا، كلمة واحدة في كل سطر..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={isLoading}
      />
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
