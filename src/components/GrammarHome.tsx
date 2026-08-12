import { BookA, Link2 } from 'lucide-react';

interface GrammarHomeProps {
  onSelect: (destination: 'conjugationDrill' | 'prepositionDrill') => void;
}

const CARDS = [
  {
    destination: 'conjugationDrill' as const,
    icon: BookA,
    title: 'Drill Conjugations',
    subtitle: 'Past, present, masdar — or just verb → masdar',
    accent: 'bg-primary text-primary-foreground',
  },
  {
    destination: 'prepositionDrill' as const,
    icon: Link2,
    title: 'Drill Prepositions',
    subtitle: 'Fill in the fixed preposition a verb always takes',
    accent: 'bg-accent text-accent-foreground',
  },
];

const GrammarHome = ({ onSelect }: GrammarHomeProps) => (
  <div className="space-y-4">
    <div className="space-y-1">
      <h2 className="text-xl font-bold text-foreground">Grammar</h2>
      <p className="text-sm text-muted-foreground">Pick a drill to sharpen the rules, not just the words.</p>
    </div>

    <div className="grid grid-cols-1 gap-3">
      {CARDS.map(({ destination, icon: Icon, title, subtitle, accent }) => (
        <button
          key={destination}
          onClick={() => onSelect(destination)}
          className="group flex items-center gap-4 rounded-2xl bg-card flashcard-shadow border border-border/50 p-5 text-left transition-all active:scale-95 hover:-translate-y-0.5"
        >
          <span className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl ${accent} transition-transform group-active:scale-90`}>
            <Icon className="h-7 w-7" />
          </span>
          <span className="flex-1 space-y-0.5">
            <span className="block text-base font-bold text-foreground">{title}</span>
            <span className="block text-sm text-muted-foreground">{subtitle}</span>
          </span>
        </button>
      ))}
    </div>
  </div>
);

export default GrammarHome;
