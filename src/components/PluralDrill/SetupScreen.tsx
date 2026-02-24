import { useState, useMemo } from 'react';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { CATEGORIES, CategoryId, Dialect, getFilteredWords } from '@/lib/plural-word-bank';

type Difficulty = 'easy' | 'normal' | 'hard';

interface SetupScreenProps {
  onStart: (
    categories: CategoryId[],
    dialect: Dialect,
    count: number,
    difficulty: Difficulty,
    showTashkeel: boolean
  ) => void;
}

const SetupScreen = ({ onStart }: SetupScreenProps) => {
  const [selectedCategories, setSelectedCategories] = useState<CategoryId[]>([
    'sound-masc', 'sound-fem', 'broken-human', 'broken-nonhuman',
  ]);
  const [dialect, setDialect] = useState<Dialect>('both');
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [showTashkeel, setShowTashkeel] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<CategoryId | null>(null);

  const availableWords = useMemo(
    () => getFilteredWords(selectedCategories, dialect),
    [selectedCategories, dialect]
  );

  const toggleCategory = (id: CategoryId) => {
    setSelectedCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const canStart = availableWords.length >= questionCount && selectedCategories.length > 0;

  const dialectOptions: { value: Dialect; label: string }[] = [
    { value: 'fusha', label: 'Fusha' },
    { value: 'both', label: 'Both' },
    { value: 'shaami', label: 'Shaami' },
  ];

  const countOptions = [10, 15, 20];

  const difficultyOptions: { value: Difficulty; label: string; desc: string }[] = [
    { value: 'easy', label: 'Easy', desc: 'Multiple choice' },
    { value: 'normal', label: 'Normal', desc: 'Type answer' },
    { value: 'hard', label: 'Hard', desc: 'No tashkeel' },
  ];

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Select Categories</p>

      <div className="space-y-2.5">
        {CATEGORIES.map(cat => {
          const isSelected = selectedCategories.includes(cat.id);
          const catWordCount = getFilteredWords([cat.id], dialect).length;
          const isExpanded = expandedCategory === cat.id;

          return (
            <div key={cat.id}>
              <button
                onClick={() => toggleCategory(cat.id)}
                className={`w-full rounded-2xl p-4 text-left transition-all border ${
                  isSelected
                    ? 'border-success bg-success/10'
                    : 'border-border bg-card'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleCategory(cat.id)}
                    className="mt-0.5 data-[state=checked]:bg-success data-[state=checked]:border-success"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground text-sm">
                        {cat.nameEn}
                      </span>
                      <span
                        className="font-arabic text-foreground text-base"
                        dir="rtl"
                        style={{ fontFamily: "'Noto Naskh Arabic', Arial, serif" }}
                      >
                        {cat.nameAr}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {catWordCount} words
                    </p>
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setExpandedCategory(isExpanded ? null : cat.id);
                    }}
                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                  </button>
                </div>
              </button>

              {isExpanded && (
                <div className="mx-4 mt-1 mb-1 p-3 rounded-xl bg-muted/60 text-sm text-muted-foreground space-y-1">
                  <p>{cat.description}</p>
                  <p
                    className="font-arabic text-foreground"
                    dir="rtl"
                    style={{ fontFamily: "'Noto Naskh Arabic', Arial, serif" }}
                  >
                    {cat.example}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dialect pills */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Dialect</p>
        <div className="flex gap-2">
          {dialectOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDialect(opt.value)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                dialect === opt.value
                  ? 'bg-success text-success-foreground'
                  : 'bg-card border border-border text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Question count pills */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Questions</p>
        <div className="flex gap-2">
          {countOptions.map(count => (
            <button
              key={count}
              onClick={() => setQuestionCount(count)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                questionCount === count
                  ? 'bg-success text-success-foreground'
                  : 'bg-card border border-border text-foreground'
              }`}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty pills */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Difficulty</p>
        <div className="flex gap-2">
          {difficultyOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                setDifficulty(opt.value);
                if (opt.value === 'hard') setShowTashkeel(false);
                else setShowTashkeel(true);
              }}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                difficulty === opt.value
                  ? 'bg-success text-success-foreground'
                  : 'bg-card border border-border text-foreground'
              }`}
            >
              <div>{opt.label}</div>
              <div className={`text-xs ${difficulty === opt.value ? 'text-success-foreground/80' : 'text-muted-foreground'}`}>
                {opt.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tashkeel toggle (only if not hard mode) */}
      {difficulty !== 'hard' && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Tashkeel</p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowTashkeel(true)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                showTashkeel
                  ? 'bg-success text-success-foreground'
                  : 'bg-card border border-border text-foreground'
              }`}
            >
              Show
            </button>
            <button
              onClick={() => setShowTashkeel(false)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                !showTashkeel
                  ? 'bg-success text-success-foreground'
                  : 'bg-card border border-border text-foreground'
              }`}
            >
              Hide
            </button>
          </div>
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground">
        {availableWords.length} words available
      </p>

      <button
        onClick={() => onStart(selectedCategories, dialect, questionCount, difficulty, showTashkeel)}
        disabled={!canStart}
        className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
      >
        Start Drilling →
      </button>
    </div>
  );
};

export default SetupScreen;
