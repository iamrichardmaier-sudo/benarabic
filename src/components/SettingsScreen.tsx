import { Sun, Moon, Monitor, Type, Volume2, LogOut, Info, ChevronRight } from 'lucide-react';
import { usePreferences } from '@/hooks/usePreferences';
import {
  setTextScale, setAudioRate, setTheme,
  TEXT_SCALE_MIN, TEXT_SCALE_MAX, TEXT_SCALE_STEP,
  AUDIO_RATE_MIN, AUDIO_RATE_MAX, AUDIO_RATE_STEP,
  type Theme,
} from '@/lib/preferences';

interface SettingsScreenProps {
  email?: string;
  deckSize: number;
  onSignOut: () => void;
  onOpenDeck: () => void;
}

const THEMES: { id: Theme; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

/**
 * One global home for app-wide preferences. Reading and audio controls also
 * appear inside the reader where they're actually used; both write through the
 * shared preferences store, so the two views can never disagree.
 *
 * Only settings that genuinely do something are listed — an inert toggle is
 * worse than a missing one.
 */
const SettingsScreen = ({ email, deckSize, onSignOut, onOpenDeck }: SettingsScreenProps) => {
  const prefs = usePreferences();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        {email && <p className="text-sm text-muted-foreground">Signed in as {email}</p>}
      </div>

      {/* Reading & display */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
          Reading &amp; display
        </h2>
        <div className="rounded-2xl border border-border bg-card divide-y divide-border">
          <div className="flex items-center justify-between gap-3 px-4 py-3.5">
            <span className="flex items-center gap-2.5 min-w-0">
              <Type className="w-5 h-5 text-primary shrink-0" />
              <span>
                <span className="block font-semibold text-foreground">Text size</span>
                <span className="block text-xs text-muted-foreground">Also adjustable while reading</span>
              </span>
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setTextScale(prefs.textScale - TEXT_SCALE_STEP)}
                disabled={prefs.textScale <= TEXT_SCALE_MIN}
                aria-label="Decrease text size"
                className="w-9 h-9 rounded-lg border border-border font-semibold text-foreground transition-colors hover:bg-muted/40 disabled:opacity-30 disabled:pointer-events-none"
              >
                A−
              </button>
              <span className="text-xs text-muted-foreground tabular-nums w-10 text-center">
                {Math.round(prefs.textScale * 100)}%
              </span>
              <button
                onClick={() => setTextScale(prefs.textScale + TEXT_SCALE_STEP)}
                disabled={prefs.textScale >= TEXT_SCALE_MAX}
                aria-label="Increase text size"
                className="w-9 h-9 rounded-lg border border-border font-semibold text-foreground transition-colors hover:bg-muted/40 disabled:opacity-30 disabled:pointer-events-none"
              >
                A+
              </button>
            </div>
          </div>

          <div className="px-4 py-3.5 space-y-2.5">
            <span className="block font-semibold text-foreground">Theme</span>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1">
              {THEMES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTheme(id)}
                  aria-pressed={prefs.theme === id}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    prefs.theme === id
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Audio */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Audio</h2>
        <div className="rounded-2xl border border-border bg-card px-4 py-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2.5">
              <Volume2 className="w-5 h-5 text-primary shrink-0" />
              <span>
                <span className="block font-semibold text-foreground">Playback speed</span>
                <span className="block text-xs text-muted-foreground">Chapter narration</span>
              </span>
            </span>
            <span className="text-sm text-muted-foreground tabular-nums shrink-0">
              {Math.round(prefs.audioRate * 100)}%
            </span>
          </div>
          <input
            type="range"
            aria-label="Playback speed"
            min={AUDIO_RATE_MIN}
            max={AUDIO_RATE_MAX}
            step={AUDIO_RATE_STEP}
            value={prefs.audioRate}
            onChange={(e) => setAudioRate(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </section>

      {/* Deck */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Your deck</h2>
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <button
            onClick={onOpenDeck}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-start transition-colors hover:bg-muted/40"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-foreground">Manage cards</span>
              <span className="block text-xs text-muted-foreground">
                {deckSize} word{deckSize === 1 ? '' : 's'}
              </span>
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        </div>
      </section>

      {/* Account */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Account</h2>
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-start text-destructive transition-colors hover:bg-muted/40"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="font-semibold">Sign out</span>
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <div className="rounded-2xl border border-border bg-card px-4 py-3.5 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Wazn — Arabic through its roots and patterns. Arabic scripture text: Smith &amp; Van Dyke
            (1865, public domain), tagged with STEPBible data under CC BY-SA 4.0. English: King James
            Version (public domain). Chapter audio courtesy of Arabic Bible Outreach Ministry.
          </p>
        </div>
      </section>
    </div>
  );
};

export default SettingsScreen;
