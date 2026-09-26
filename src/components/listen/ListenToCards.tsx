import { useMemo, useState } from 'react';
import { Play, Pause, Loader2, Headphones, Minus, Plus } from 'lucide-react';
import BackButton from '@/components/BackButton';
import DeckIcon from '@/components/decks/DeckIcon';
import { useDeckLibrary } from '@/hooks/useDeckLibrary';
import { useListenPlayer } from '@/hooks/useListenPlayer';
import { fetchListenCards, type ListenCard } from '@/lib/deck-store';
import { buildListenTrack } from '@/lib/listen-audio';
import { FOUNDATION_ICON } from '@/lib/deck-icons';
import type { FlashCard } from '@/lib/spaced-repetition';
import { useAuth } from '@/hooks/useAuth';

type Stage = 'sets' | 'config' | 'generating' | 'playing';

interface Set {
  id: string; // deck id, or 'all'
  title: string;
  count: number;
  icon: string;
  iconUrl: string | null;
}

const ALL_SET: Set = { id: 'all', title: 'All my cards', count: 0, icon: FOUNDATION_ICON, iconUrl: null };

function reason(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return 'Something went wrong.';
}

/**
 * Hands-free listening: pick a set, choose how many times each side
 * repeats, and it plays on a loop -- through the lock screen, same as a
 * podcast -- until you stop it.
 */
const ListenToCards = ({ cards, onBack }: { cards: FlashCard[]; onBack: () => void }) => {
  const { user } = useAuth();
  const { decks, mine, loading: decksLoading } = useDeckLibrary();
  const [stage, setStage] = useState<Stage>('sets');
  const [chosen, setChosen] = useState<Set | null>(null);
  const [arabicRepeats, setArabicRepeats] = useState(2);
  const [englishRepeats, setEnglishRepeats] = useState(1);
  const [gapSeconds, setGapSeconds] = useState(2);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const { state, play, toggle, stop } = useListenPlayer(chosen?.title ?? 'Listen to cards');

  const cardsWithEnglish = useMemo(() => cards.filter((c) => c.english), [cards]);

  const sets = useMemo(() => {
    const mySets = decks
      .filter((d) => mine.has(d.id))
      .map((d) => ({
        id: d.id,
        title: mine.get(d.id) || d.title,
        count: d.wordCount ?? 0,
        icon: d.icon,
        iconUrl: d.iconUrl,
      }));
    return [{ ...ALL_SET, count: cardsWithEnglish.length }, ...mySets];
  }, [decks, mine, cardsWithEnglish.length]);

  const chooseSet = (set: Set) => {
    setChosen(set);
    setError(null);
    setStage('config');
  };

  const start = async () => {
    if (!chosen || !user) return;
    setError(null);
    setStage('generating');
    setProgress({ done: 0, total: 0 });
    try {
      let listenCards: ListenCard[];
      if (chosen.id === 'all') {
        listenCards = cardsWithEnglish.map((c) => ({ arabic: c.wordVoweled || c.word, english: c.english as string }));
      } else {
        listenCards = await fetchListenCards(chosen.id, user.id);
      }
      if (listenCards.length === 0) {
        setError('That set has no cards with an English side to listen to.');
        setStage('config');
        return;
      }
      setProgress({ done: 0, total: listenCards.length });
      const blob = await buildListenTrack(
        listenCards,
        { arabicRepeats, englishRepeats, gapSeconds },
        (done, total) => setProgress({ done, total }),
      );
      play(URL.createObjectURL(blob));
      setStage('playing');
    } catch (err) {
      setError(reason(err));
      setStage('config');
    }
  };

  const back = () => {
    if (stage === 'playing') stop();
    if (stage === 'config' || stage === 'playing') {
      setStage('sets');
      setChosen(null);
      return;
    }
    onBack();
  };

  const counter = (label: string, value: number, onChange: (v: number) => void, min: number, max: number) => (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`Fewer ${label.toLowerCase()}`}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
          disabled={value <= min}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-6 text-center text-sm font-semibold tabular-nums text-foreground">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label={`More ${label.toLowerCase()}`}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
          disabled={value >= max}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <BackButton onClick={back} label={stage === 'sets' ? 'Learn' : 'Sets'} />

      {stage === 'sets' && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">Listen to cards</h1>
            <p className="text-sm text-muted-foreground">
              Pick a set to play on a loop, hands-free.
            </p>
          </div>

          {decksLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {sets.map((set) => (
                <button
                  key={set.id}
                  onClick={() => chooseSet(set)}
                  disabled={set.count === 0}
                  className="overflow-hidden rounded-2xl border border-border bg-card text-start transition-all active:scale-95 hover:bg-muted/40 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <span className="flex h-24 items-center justify-center bg-muted/40 text-primary">
                    <DeckIcon
                      icon={set.icon}
                      iconUrl={set.iconUrl}
                      foundation={set.id === 'all'}
                      size="md"
                    />
                  </span>
                  <span className="block min-w-0 px-3 py-2.5">
                    <span className="block truncate text-sm font-semibold text-foreground">{set.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {set.count} word{set.count === 1 ? '' : 's'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {stage === 'config' && chosen && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <DeckIcon icon={chosen.icon} iconUrl={chosen.iconUrl} foundation={chosen.id === 'all'} size="lg" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground">{chosen.title}</h1>
              <p className="text-sm text-muted-foreground">{chosen.count} word{chosen.count === 1 ? '' : 's'}</p>
            </div>
          </div>

          <div className="space-y-2">
            {counter('Repeat in Arabic', arabicRepeats, setArabicRepeats, 1, 5)}
            {counter('Repeat in English', englishRepeats, setEnglishRepeats, 1, 5)}
            {counter('Seconds between', gapSeconds, setGapSeconds, 1, 10)}
          </div>

          {error && (
            <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            onClick={start}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-all active:scale-95"
          >
            <Headphones className="h-4 w-4" />
            Start listening
          </button>
          <p className="text-center text-[11px] text-muted-foreground">
            Each word is spoken once and repeated in the audio itself, so this takes a little while
            to prepare the first time.
          </p>
        </div>
      )}

      {stage === 'generating' && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-6 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">
            {progress.total > 0
              ? `Preparing word ${progress.done} of ${progress.total}…`
              : 'Preparing the audio…'}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      {stage === 'playing' && chosen && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-4 text-center">
          <DeckIcon
            icon={chosen.icon}
            iconUrl={chosen.iconUrl}
            foundation={chosen.id === 'all'}
            size="lg"
            className="mx-auto"
          />
          <p className="font-semibold text-foreground">{chosen.title}</p>
          <button
            onClick={toggle}
            aria-label={state.playing ? 'Pause' : 'Play'}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all active:scale-95"
          >
            {state.loading ? <Loader2 className="h-7 w-7 animate-spin" />
              : state.playing ? <Pause className="h-7 w-7" />
              : <Play className="h-7 w-7 ps-1" />}
          </button>
          {state.error && <p className="text-xs text-destructive">{state.error}</p>}
          <p className="text-[11px] text-muted-foreground">
            Keeps playing with the screen off, on a loop, until you stop it here.
          </p>
        </div>
      )}
    </div>
  );
};

export default ListenToCards;
