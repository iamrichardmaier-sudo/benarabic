import { GraduationCap, Sparkles, Brain, type LucideIcon } from 'lucide-react';

export type Tab = 'wordMastery' | 'grammar' | 'memorization';

interface BottomNavProps {
  active: Tab;
  onSelect: (tab: Tab) => void;
}

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'wordMastery', label: 'Word Mastery', icon: GraduationCap },
  { id: 'grammar', label: 'Grammar', icon: Sparkles },
  { id: 'memorization', label: 'Memorization', icon: Brain },
];

/** Fixed app-wide tab bar. Bold and playful on purpose — this is the primary
 * way to move around, so it should read as the loudest thing on screen. */
const BottomNav = ({ active, onSelect }: BottomNavProps) => (
  <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-card/95 backdrop-blur-sm">
    <div className="max-w-lg mx-auto grid grid-cols-3 gap-2 px-3 py-2.5">
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex flex-col items-center gap-1 rounded-2xl py-2.5 font-semibold transition-all active:scale-90 ${
              isActive
                ? 'bg-primary text-primary-foreground shadow-md scale-105'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <Icon className={isActive ? 'w-6 h-6' : 'w-5 h-5'} />
            <span className="text-xs">{label}</span>
          </button>
        );
      })}
    </div>
  </nav>
);

export default BottomNav;
