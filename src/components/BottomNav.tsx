import { Home, GraduationCap, Library, Layers, Settings, type LucideIcon } from 'lucide-react';

export type Tab = 'home' | 'learn' | 'library' | 'review' | 'settings';

interface BottomNavProps {
  active: Tab;
  onSelect: (tab: Tab) => void;
  /** Due-card count, surfaced as a badge on Review so it's visible everywhere. */
  dueCount?: number;
}

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'learn', label: 'Learn', icon: GraduationCap },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'review', label: 'Review', icon: Layers },
  { id: 'settings', label: 'Settings', icon: Settings },
];

/**
 * Persistent app-wide tab bar — five destinations, icon + label, always
 * visible, sized for the thumb zone. Tapping the tab you are already on is
 * handled by the caller as "jump back to this section's root", matching the
 * drill-down convention users expect from library apps.
 */
const BottomNav = ({ active, onSelect, dueCount = 0 }: BottomNavProps) => (
  <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-card/95 backdrop-blur-sm">
    <div className="max-w-lg mx-auto grid grid-cols-5 gap-1 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        const showBadge = id === 'review' && dueCount > 0;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={showBadge ? `${label}, ${dueCount} due` : label}
            className={`relative flex flex-col items-center gap-1 rounded-2xl py-2 min-h-[3rem] font-semibold transition-all active:scale-90 ${
              isActive
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <span className="relative">
              <Icon className="w-5 h-5" />
              {showBadge && (
                <span
                  aria-hidden="true"
                  className={`absolute -top-1.5 -end-2 min-w-[1.05rem] h-[1.05rem] px-1 rounded-full text-[10px] leading-[1.05rem] text-center font-bold ${
                    isActive ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground'
                  }`}
                >
                  {dueCount > 99 ? '99+' : dueCount}
                </span>
              )}
            </span>
            <span className="text-[11px] leading-none">{label}</span>
          </button>
        );
      })}
    </div>
  </nav>
);

export default BottomNav;
