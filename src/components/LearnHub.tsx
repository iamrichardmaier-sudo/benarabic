import {
  GraduationCap, BookOpen, Plus, RefreshCw, List,
  Sparkles, Link2, Brain, ChevronRight, Search, type LucideIcon,
} from 'lucide-react';

export type LearnDestination =
  | 'learn' | 'review' | 'add' | 'relearn' | 'deck' | 'lookup'
  | 'conjugationDrill' | 'prepositionDrill'
  | 'memorize';

interface LearnHubProps {
  dueCount: number;
  learnCount: number;
  deckSize: number;
  onSelect: (destination: LearnDestination) => void;
}

interface Item {
  id: LearnDestination;
  label: string;
  hint: string;
  icon: LucideIcon;
  disabled?: boolean;
}

/**
 * Everything that is practice rather than reading, in one place: flashcards
 * first (the daily habit), then grammar drills, then memorization. Reading
 * lives in Library; this screen never opens a text for its own sake.
 */
const LearnHub = ({ dueCount, learnCount, deckSize, onSelect }: LearnHubProps) => {
  const sections: { title: string; items: Item[] }[] = [
    {
      title: 'Flashcards',
      items: [
        {
          id: 'learn', label: 'Learn new words', icon: GraduationCap,
          hint: learnCount > 0 ? `${learnCount} waiting` : 'Nothing new right now',
          disabled: learnCount === 0,
        },
        {
          id: 'review', label: 'Review', icon: BookOpen,
          hint: dueCount > 0 ? `${dueCount} due` : 'All caught up',
          disabled: dueCount === 0,
        },
        { id: 'add', label: 'Add words', icon: Plus, hint: 'Type or paste a list' },
        {
          id: 'lookup', label: 'Look up a word', icon: Search,
          hint: 'Search the tagged Bible and add what you find',
        },
        {
          id: 'relearn', label: 'Relearn cards', icon: RefreshCw,
          hint: 'Reset cards you want to see again', disabled: deckSize === 0,
        },
        { id: 'deck', label: 'My deck', icon: List, hint: `${deckSize} word${deckSize === 1 ? '' : 's'}` },
      ],
    },
    {
      title: 'Grammar',
      items: [
        { id: 'conjugationDrill', label: 'Drill conjugations', icon: Sparkles, hint: 'Past, present and masdar by form' },
        { id: 'prepositionDrill', label: 'Drill prepositions', icon: Link2, hint: 'Verbs that take a fixed preposition' },
      ],
    },
    {
      title: 'Memorization',
      items: [
        { id: 'memorize', label: 'Memorize a transcript', icon: Brain, hint: 'Hide words and recall the passage' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Learn</h1>
        <p className="text-sm text-muted-foreground">Practice drills and flashcards.</p>
      </div>

      {sections.map((section) => (
        <section key={section.title} className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
            {section.title}
          </h2>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {section.items.map((item, i) => (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                disabled={item.disabled}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-start transition-colors hover:bg-muted/40 disabled:opacity-40 disabled:pointer-events-none ${
                  i > 0 ? 'border-t border-border' : ''
                }`}
              >
                <item.icon className="w-5 h-5 text-primary shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-foreground">{item.label}</span>
                  <span className="block text-xs text-muted-foreground truncate">{item.hint}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default LearnHub;
