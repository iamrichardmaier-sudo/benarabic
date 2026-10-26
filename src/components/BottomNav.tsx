import { Home, GraduationCap, Library, Layers, Settings, List, CloudOff, type LucideIcon } from 'lucide-react';
import WaznLogo from '@/components/WaznLogo';

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
  // Phones and tablets. From laptop width the SideNav below takes over.
  <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-card/95 backdrop-blur-sm lg:hidden">
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

interface SideNavProps extends BottomNavProps {
  deckSize: number;
  onOpenDeck: () => void;
  deckOpen?: boolean;
  online?: boolean;
  pendingCount?: number;
}

/**
 * The same five destinations as a sidebar, for laptop and desktop screens: a
 * thumb-sized tab bar along the bottom of a wide window is a phone pattern,
 * and it left most of the screen empty. Also holds what the phone header
 * shows (the logo, My Deck, the sync state), since the header is hidden here.
 */
export const SideNav = ({
  active, onSelect, dueCount = 0, deckSize, onOpenDeck, deckOpen = false, online = true, pendingCount = 0,
}: SideNavProps) => (
  <nav
    aria-label="Main"
    className="fixed inset-y-0 start-0 z-20 hidden w-60 flex-col border-e border-border/60 bg-card/60 px-3 py-5 lg:flex"
  >
    <button
      onClick={() => onSelect('home')}
      aria-label="Wazn — go to Home"
      className="mb-6 flex items-center px-3 text-primary"
    >
      <WaznLogo size={30} wordmark />
    </button>
    <div className="space-y-1">
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id && !deckOpen;
        const showBadge = id === 'review' && dueCount > 0;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={showBadge ? `${label}, ${dueCount} due` : label}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
              isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-start">{label}</span>
            {showBadge && (
              <span
                aria-hidden="true"
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                  isActive ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground'
                }`}
              >
                {dueCount > 99 ? '99+' : dueCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
    <div className="my-4 border-t border-border/60" />
    <button
      onClick={onOpenDeck}
      aria-current={deckOpen ? 'page' : undefined}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
        deckOpen ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      }`}
    >
      <List className="h-5 w-5 shrink-0" />
      <span className="flex-1 text-start">My deck</span>
      <span className={`text-xs tabular-nums ${deckOpen ? '' : 'text-muted-foreground'}`}>{deckSize}</span>
    </button>
    {(!online || pendingCount > 0) && (
      <p className="mt-auto flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
        <CloudOff className="h-4 w-4 shrink-0" />
        {online
          ? `${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to sync`
          : 'Offline. Your work is saved here and syncs later.'}
      </p>
    )}
  </nav>
);

export default BottomNav;
