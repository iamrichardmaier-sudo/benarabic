import { useState, useCallback, useEffect, useRef } from 'react';
import { BookOpen, Plus, Layers, List, GraduationCap, LogOut, RefreshCw, CloudOff } from 'lucide-react';
import AddWords from '@/components/AddWords';
import Flashcard, { ReviewDirection } from '@/components/Flashcard';
import FocusReview from '@/components/FocusReview';
import PodcastPlayer from '@/components/podcasts/PodcastPlayer';
import { fetchPodcastById, type Podcast, type Register } from '@/lib/podcasts';
import ReviewComplete from '@/components/ReviewComplete';
import DeckList from '@/components/DeckList';
import LearningMode from '@/components/LearningMode';
import RelearnModal from '@/components/RelearnModal';
import { today } from '@/lib/day';
import { DeckContext } from '@/contexts/DeckContext';
import ConjugationDrill from '@/components/ConjugationDrill';
import PrepositionDrill from '@/components/PrepositionDrill';
import NumbersDrill from '@/components/NumbersDrill';
import MemorizeTranscript from '@/components/MemorizeTranscript';
import ListenToCards from '@/components/listen/ListenToCards';
import WordLookup from '@/components/WordLookup';
import { entryToCardFields, type DictionaryEntry } from '@/lib/dictionary';
import Library from '@/components/library/Library';
import HomeDashboard from '@/components/HomeDashboard';
import LearnHub, { type LearnDestination } from '@/components/LearnHub';
import AnkiTransfer from '@/components/AnkiTransfer';
import RootExplorer from '@/components/roots/RootExplorer';
import FormsTab from '@/components/forms/FormsTab';
import SettingsScreen from '@/components/SettingsScreen';
import PdfToAudio from '@/components/PdfToAudio';
import LearnDecks from '@/components/decks/LearnDecks';
import DeckBuilder from '@/components/decks/DeckBuilder';
import AdminDecks from '@/components/decks/AdminDecks';
import ImportWords from '@/components/decks/ImportWords';
import FeedbackForm from '@/components/FeedbackForm';
import { useDeckLibrary } from '@/hooks/useDeckLibrary';
import type { Deck } from '@/lib/deck-store';
import BottomNav, { SideNav, type Tab } from '@/components/BottomNav';
import BackButton from '@/components/BackButton';
import WaznLogo from '@/components/WaznLogo';
import AppBackground from '@/components/backgrounds/AppBackground';
import { addXp, getSnapshot, lastSeenLevel, loadProgress, markLevelSeen, setBackground } from '@/lib/progress';
import { useProgress } from '@/hooks/useProgress';
import { LEVEL_XP, levelFor, xpForGrade } from '@/lib/levels';
import SessionSummaryDialog, { type SessionSummary } from '@/components/levels/SessionSummaryDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { parsePath, pathFor, type View } from '@/lib/app-routes';
import { recordStudyDay } from '@/lib/streak';
import { FlashCard, Rating, createCard, reviewCard, getDueCards, getLearnableCards, parseWordLine, scheduleFields, nextWave, isSentence } from '@/lib/spaced-repetition';
import SentenceOrder from '@/components/SentenceOrder';
import { useSentencesOnly } from '@/hooks/useSentencesOnly';
import { learnQueue, learnSplit } from '@/lib/learn-filter';
import { splitDuplicates } from '@/lib/duplicates';
import { queueAfterGrade, cardsCovered } from '@/lib/review-queue';
import { learnedRecently, RECENT_DAYS } from '@/lib/recent-words';
import { DeckActionsContext, type NewWord } from '@/contexts/DeckActionsContext';
import { useFlashcards } from '@/hooks/useFlashcards';
import { useHasKeyboard } from '@/hooks/useHasKeyboard';
import { useAuth } from '@/hooks/useAuth';
import { searchImage, backfillMissingImages } from '@/lib/unsplash';
import { tagCards, tagUntaggedDeck, repairVerbMasdarPairs } from '@/lib/auto-tag-deck';
import { markNeedsImage } from '@/lib/offline-cache';
import type { TaggedImportEntry } from '@/lib/import-tagged';
import { useToast } from '@/hooks/use-toast';

/**
 * The chapter filter that used to sit under the header is gone, but a device
 * that had one switched on still has it saved. Nothing reads it any more, so it
 * is cleared once rather than left behind.
 */
/** Screens that use the full width on a laptop; the rest keep a reading width. */
const WIDE_VIEWS = new Set<View>(['home', 'learnHub', 'library', 'deck', 'learnDecks', 'rootExplorer', 'lookup', 'verbForms']);

const RETIRED_ACTIVE_GROUP_KEY = 'arabic-flashcards-active-group';

/** Supabase errors are plain objects, not Error instances — read .message off either. */
function errorReason(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

const Index = () => {
  const { cards, loading, addCards, updateCard, deleteCard, refetch, online, pendingCount } = useFlashcards();
  const { signOut, user } = useAuth();
  // The screen comes from the address, so a refresh, a bookmark or a shared
  // link opens where it points (see lib/app-routes).
  const [initial] = useState(() => parsePath(window.location.pathname) ?? { tab: 'home' as Tab, view: 'home' as View });
  const [tab, setTab] = useState<Tab>(initial.tab);
  const [view, setView] = useState<View>(initial.view);
  /** Where in the Library the address points ("bible/John/3"). */
  const [libraryPath, setLibraryPath] = useState(initial.libraryPath ?? '');
  const [reviewItems, setReviewItems] = useState<{ card: FlashCard; direction: ReviewDirection }[]>([]);
  /**
   * True while running the practice set rather than the day's reviews.
   *
   * Practice deliberately writes nothing: the point is extra exposure on
   * demand, and if grading here moved the schedule then going through the set
   * twice in an evening would push this week's words out to next month —
   * the opposite of what asking for more practice means.
   */
  const [practising, setPractising] = useState(false);
  /** Learn only the sentence cards, when there are any waiting. */
  const [sentencesOnly, setSentencesOnly] = useSentencesOnly();
  /** Full-screen, keyboard-driven review — the phone widget's session. */
  const [focusReview, setFocusReview] = useState(false);
  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showRelearnModal, setShowRelearnModal] = useState(false);
  // Bumped to tell the Library to return to its root, or to open the stored
  // reading position — both are actions only the Library can carry out.
  const [libraryReset, setLibraryReset] = useState(0);
  const [libraryResume, setLibraryResume] = useState(0);
  const { toast } = useToast();

  // XP and the chosen background, for whoever is signed in.
  useEffect(() => {
    void loadProgress(user?.id ?? null);
  }, [user?.id]);
  const progress = useProgress();

  /**
   * The study session in progress (review, practice or learn) and the XP it
   * has earned. When the learner leaves the session's screen, it is summed up
   * in the summary dialog, with any level reached and background unlocked.
   */
  const session = useRef<{ label: string; startXp: number; earned: number } | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const earn = useCallback((amount: number) => {
    addXp(amount);
    if (session.current) session.current.earned += amount;
  }, []);
  const startSession = (label: string) => {
    endSession();
    session.current = { label, startXp: getSnapshot().xp, earned: 0 };
  };
  const endSession = () => {
    const s = session.current;
    session.current = null;
    if (!s || s.earned <= 0) return;
    setSummary({ label: s.label, startXp: s.startXp, endXp: s.startXp + s.earned, earned: s.earned });
  };
  const closeSummary = () => {
    setSummary(null);
    markLevelSeen(levelFor(getSnapshot().xp));
  };

  // Learn opens a session of its own; leaving review or Learn ends one.
  const prevView = useRef<View | null>(null);
  useEffect(() => {
    const prev = prevView.current;
    prevView.current = view;
    if (prev === view) return;
    if (prev === 'review' || prev === 'learnCards') endSession();
    if (view === 'learnCards') startSession('Learn');
    // startSession/endSession only touch refs and setSummary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // A level reached away from this screen (on the widget, or a session left
  // by closing the app) is celebrated once the totals arrive.
  useEffect(() => {
    if (!progress.loaded || !user?.id) return;
    const level = levelFor(progress.xp);
    const seen = lastSeenLevel();
    if (seen === null) markLevelSeen(level);
    else if (level > seen && !session.current) {
      setSummary((open) => open ?? { startXp: LEVEL_XP[seen - 1], endXp: progress.xp });
    }
    // Only when the totals (re)load, not on every XP earned in a session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.loaded, user?.id]);
  const { admin: isDeckAdmin } = useDeckLibrary();
  const backfillRan = useRef(false);
  const podcastLinkRan = useRef(false);
  const [podcastRegister, setPodcastRegister] = useState<Register | null>(null);

  // Each screen change becomes a history entry with its own address, so the
  // browser's Back walks back through screens instead of leaving the app.
  // When the address already matches (we got here by Back/Forward, or the
  // page just loaded) nothing is pushed. The tab is kept in the entry's
  // state because a few screens (My Deck, decks) can be reached from more
  // than one tab.
  const url = pathFor({ tab, view, libraryPath, podcastId: podcast?.id ?? initial.podcastId });
  useEffect(() => {
    if (window.location.pathname === url) {
      window.history.replaceState({ ...(window.history.state ?? {}), waznTab: tab }, '');
      return;
    }
    window.history.pushState({ waznTab: tab }, '', url);
  }, [url, tab]);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const loc = parsePath(window.location.pathname) ?? { tab: 'home' as Tab, view: 'home' as View };
      setTab((e.state?.waznTab as Tab | undefined) ?? loc.tab);
      setView(loc.view);
      if (loc.view === 'library') setLibraryPath(loc.libraryPath ?? '');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Opened straight onto a podcast's address: fetch it, or fall back to Learn.
  useEffect(() => {
    if (initial.view !== 'podcast' || !initial.podcastId || !user) return;
    fetchPodcastById(initial.podcastId)
      .then((found) => {
        if (found) setPodcast(found);
        else setView('learnHub');
      })
      .catch(() => setView('learnHub'));
    // Only the address the app was opened on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // A Scriptable widget cannot run the app in place -- tapping a podcast in
  // its browse list is a URL open, same as every other deep link this app
  // gets. ?podcast=<id> lands straight on that podcast's player rather than
  // the browse-and-tap-around a fresh launch would otherwise need, and
  // &register= skips the picker too when the widget already asked.
  useEffect(() => {
    try {
      localStorage.removeItem(RETIRED_ACTIVE_GROUP_KEY);
    } catch {
      /* nothing was saved, or storage is unavailable */
    }
  }, []);

  useEffect(() => {
    if (!user || podcastLinkRan.current) return;
    const params = new URLSearchParams(window.location.search);
    const podcastId = params.get('podcast');
    if (!podcastId) return;
    podcastLinkRan.current = true;

    const register = params.get('register');
    const validRegister: Register | null =
      register === 'shaami' || register === 'fusha' || register === 'both' ? register : null;

    // The link has done its job once read; stripped so a refresh reopens
    // wherever the learner actually is rather than snapping back here.
    const url = new URL(window.location.href);
    url.searchParams.delete('podcast');
    url.searchParams.delete('register');
    window.history.replaceState({}, '', url.toString());

    fetchPodcastById(podcastId)
      .then((found) => {
        if (!found) return;
        setPodcast(found);
        setPodcastRegister(validRegister);
        setTab('learn');
        setView('podcast');
      })
      .catch((err) => console.error('Could not open the linked podcast:', err));
  }, [user]);

  // Catch-up work that needs a connection: tag cards that predate auto-tagging
  // or were added offline, and fetch the pictures those cards went without.
  // Resets when the connection drops so it runs again once we're back.
  useEffect(() => {
    if (loading || !online) {
      backfillRan.current = false;
      return;
    }
    if (backfillRan.current) return;
    backfillRan.current = true;

    (async () => {
      try {
        const summary = await tagUntaggedDeck();
        const filled = await backfillMissingImages(user?.id, cards, updateCard);
        if (summary.tagged > 0 || filled > 0) await refetch();
      } catch (err) {
        console.error('Deck backfill failed:', err);
      }
    })();
  }, [loading, online, user?.id, cards, updateCard, refetch]);

  const handleAddWords = async (lines: string[], chapter: string) => {
    setIsLoading(true);
    try {
      // Words already in the deck are left out before anything is looked up, so
      // a repeat costs no image search and no tagging.
      const candidates: FlashCard[] = [];
      for (const line of lines) {
        for (const { fusha, shaami, english } of parseWordLine(line)) {
          if (!fusha) continue;
          candidates.push({ ...createCard(fusha, english, null, shaami), group: chapter || null });
        }
      }
      const { fresh, duplicates } = splitDuplicates(cards, candidates);
      const skippedNote = duplicates.length > 0
        ? `${duplicates.length} already in your deck, skipped: ${duplicates.map((c) => c.word).join('، ')}`
        : '';
      if (fresh.length === 0) {
        toast({ title: 'Nothing new to add', description: skippedNote || 'Add at least one word.' });
        return;
      }

      let imageError: string | null = null;
      let imagesDeferred = false;
      const withImages: FlashCard[] = [];
      for (const card of fresh) {
        const { imageUrl, error, deferred } = await searchImage(card.english || card.word);
        if (error && !imageError) imageError = error;
        if (deferred) imagesDeferred = true;
        withImages.push({ ...card, imageUrl });
      }
      const { added: newCards, skipped } = await addCards(withImages);
      if (imagesDeferred) markNeedsImage(user?.id, newCards.map((c) => c.id));
      const found = newCards.filter((c) => c.imageUrl).length;
      const detail = imagesDeferred
        ? 'Saved on this device — pictures and tags fill in when you reconnect.'
        : imageError
          ? `${found} images found — image lookup failed for the rest: ${imageError}`
          : `${found} images found`;
      const alsoSkipped = skipped.length > 0 && duplicates.length === 0
        ? `${skipped.length} already in your deck, skipped`
        : skippedNote;
      toast({
        title: `Added ${newCards.length} word${newCards.length === 1 ? '' : 's'}`,
        description: alsoSkipped ? `${detail}. ${alsoSkipped}` : detail,
      });
      setView('home');
      try {
        await tagCards(newCards.map((c) => ({ id: c.id, word: c.word, shaami: c.shaami })));
        await refetch();
      } catch (tagErr) {
        console.error('Auto-tag failed:', tagErr);
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Error adding words', description: errorReason(err), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const TAB_HOME_VIEW: Record<Tab, View> = {
    home: 'home',
    learn: 'learnHub',
    library: 'library',
    review: 'review',
    settings: 'settings',
  };

  const TAB_LABEL: Record<Tab, string> = {
    home: 'Home', learn: 'Learn', library: 'Library', review: 'Home', settings: 'Settings',
  };

  /** Tapping a tab always returns to that section's root, including the tab
   *  you are already on — the standard "tap again to go back up" shortcut. */
  const selectTab = (next: Tab) => {
    // Re-tapping Library while already there means "back to the top of the
    // Library", which only the Library itself can act on — hence the token.
    if (next === 'library' && tab === 'library') setLibraryReset((n) => n + 1);
    // A tab opens at its root; for the Library that is its front page.
    if (next === 'library') setLibraryPath('');
    setTab(next);
    if (next === 'review') return startReview();
    setView(TAB_HOME_VIEW[next]);
  };

  /** Reachable from any screen via the header's word-count badge. Leaves the
   *  active tab as it is, so BottomNav keeps showing where you actually came
   *  from — forcing it to Settings used to land Back on a Settings screen
   *  you never opened. */
  const goToDeck = () => {
    setView('deck');
  };

  const openLearnDestination = (destination: LearnDestination) => {
    switch (destination) {
      case 'learn': return setView('learnCards');
      case 'review': return startReview();
      case 'relearn': return setShowRelearnModal(true);
      case 'learnDecks': return setView('learnDecks');
      default: return setView(destination as View);
    }
  };

  /** Home's "continue reading" hands off to the Library, which reads the same
   *  stored position and opens straight into the reader. */
  const continueReading = (bookCode: string, chapter: number) => {
    try {
      localStorage.setItem('arabic-flashcards-bible-book', bookCode);
      localStorage.setItem('arabic-flashcards-bible-chapter', String(chapter));
    } catch {
      /* the Library falls back to its own stored position */
    }
    setTab('library');
    setView('library');
    setLibraryPath(`bible/${bookCode}/${chapter}`);
    setLibraryResume((n) => n + 1);
  };

  const groups = [...new Set(cards.map((c) => c.group).filter((g): g is string => !!g))].sort();
  /** What the study modes work from: the whole deck. */
  const studyCards = cards;

  /**
   * Review works from the whole deck: the spaced-repetition schedule is a
   * promise about every card, so one falling due is never left out.
   */
  const openSession = (pool: FlashCard[], practice: boolean) => {
    const items: { card: FlashCard; direction: ReviewDirection }[] = [];
    for (const card of pool) {
      // A sentence is one item, not one per direction: its exercise is the
      // word ordering, which it runs twice by itself.
      items.push({ card, direction: 'ar-to-en' });
      if (!isSentence(card)) items.push({ card, direction: 'en-to-ar' });
    }
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    setPractising(practice);
    startSession(practice ? 'Practice' : 'Review');
    setReviewItems(items);
    setCurrentIndex(0);
    setView('review');
  };

  const startReview = () => openSession(getDueCards(cards), false);

  // Opened on /review: start the day's review as soon as the deck is in.
  const reviewOpened = useRef(false);
  useEffect(() => {
    if (initial.view !== 'review' || loading || reviewOpened.current) return;
    reviewOpened.current = true;
    startReview();
    // startReview reads the deck, which is ready once loading is false.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  /** This week's words again, whether or not they are due. */
  const startPractice = () => openSession(learnedRecently(cards), true);

  /**
   * A word sent to the deck from whatever is being read.
   *
   * It lands unlearned, which is what puts it at the front of the Learn queue
   * rather than dropping it into a review schedule it has not earned.
   */
  const addWordFromReader = useCallback(
    async (word: NewWord) => {
      const { added } = await addCards([
        {
          ...createCard(word.word, word.english ?? null, null, null),
          root: word.root ?? null,
          wordType: (word.wordType as FlashCard['wordType']) ?? null,
          verbForm: (word.verbForm as FlashCard['verbForm']) ?? null,
          wordVoweled: word.word,
        },
      ]);
      if (added.length === 0) {
        toast({ title: `${word.word} is already in your deck` });
        return;
      }
      toast({ title: `Added ${word.word}`, description: 'It is waiting in Learn.' });
    },
    [addCards, toast],
  );

  const handleRate = async (rating: Rating) => {
    const item = reviewItems[currentIndex];
    if (!practising) {
      const reviewed = reviewCard(item.card, rating);
      await updateCard(reviewed.id, scheduleFields(reviewed));
    }
    // Grading a card is a genuine study action, so it counts toward the streak.
    recordStudyDay(user?.id);
    earn(xpForGrade(rating, practising));
    setReviewItems((items) => queueAfterGrade(items, currentIndex, rating));
    setCurrentIndex((i) => i + 1);
  };

  /**
   * Adds a dictionary entry to the deck as a new card.
   *
   * No image lookup: the entry already carries a gloss, a root and a form,
   * and an image search on a word like "before" returns noise. The card can
   * be given one later from My Deck.
   */
  const handleAddFromDictionary = async (entry: DictionaryEntry) => {
    const fields = entryToCardFields(entry);
    try {
      const { added } = await addCards([
        {
          ...createCard(fields.word, fields.english, null, null),
          root: fields.root,
          wordType: fields.wordType,
          verbForm: fields.verbForm,
          wordVoweled: fields.word,
          taggedAt: new Date().toISOString(),
        },
      ]);
      toast({ title: added.length === 0 ? `${fields.word} is already in your deck` : `Added ${fields.word}` });
    } catch (err) {
      console.error('Could not add the word:', err);
      toast({ title: 'Could not add that word', variant: 'destructive' });
      throw err;
    }
  };

  const handleDelete = async (id: string) => {
    await deleteCard(id);
  };

  const handleUpdateCard = async (id: string, updates: Partial<FlashCard>) => {
    await updateCard(id, updates);
  };

  const handleStartRelearn = async (cardIds: string[]) => {
    const startDate = today();
    for (const id of cardIds) {
      await updateCard(id, {
        easeFactor: 2.5,
        intervalDays: 0,
        learningStage: 'new',
        stage1Attempts: 0,
        stage2Attempts: 0,
        nextReviewDate: startDate,
      });
    }
    setShowRelearnModal(false);
    toast({ title: `Reset ${cardIds.length} card${cardIds.length !== 1 ? 's' : ''} for relearning` });
    setTab('learn');
    setView('learnCards');
  };

  // Due count is global, matching the global review queue — a badge that
  // disagreed with the session it launches would be worse than no badge.
  const dueCount = getDueCards(cards).length;
  const upcomingWave = nextWave(cards);
  const recentlyLearned = learnedRecently(cards);
  const learnable = getLearnableCards(studyCards);
  const learnCards = learnQueue(learnable, sentencesOnly);
  const learnWaiting = learnSplit(learnable);
  // What Learn will actually open on, so the count and the session agree.
  const learnCount = learnCards.length;
  const reviewDone = view === 'review' && currentIndex >= reviewItems.length;
  const hasKeyboard = useHasKeyboard();
  const reviewing = view === 'review' && !reviewDone && Boolean(reviewItems[currentIndex]);
  // A sentence is reviewed by ordering its words, which has no flip to
  // fullscreen and no grade keys, so Enter and the full-screen session stay
  // out of its way.
  const reviewingSentence = reviewing && isSentence(reviewItems[currentIndex].card);

  // Enter opens the full-screen session, from the review screen only. The
  // listener is hung here rather than inside FocusReview because the screen it
  // opens does not exist yet when the key is pressed.
  useEffect(() => {
    if (!reviewing || focusReview || reviewingSentence) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      setFocusReview(true);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [reviewing, focusReview, reviewingSentence]);

  // A session that runs out closes the full screen with it, rather than
  // leaving an empty card behind for the arrow keys to grade.
  useEffect(() => {
    if (!reviewing) setFocusReview(false);
  }, [reviewing]);

  if (loading) {
    // Shaped like the Home screen it is about to become, rather than a
    // centered sentence — this is the very first thing a freshly signed-up
    // reader sees, so it is worth more than a blank moment.
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="mx-auto px-4 py-4 flex items-center justify-between w-full max-w-lg">
            <span className="flex items-center text-primary">
              <WaznLogo size={28} wordmark />
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto px-4 py-4 w-full max-w-lg space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-9 w-16 rounded-2xl shrink-0" />
            </div>
            <Skeleton className="h-16 w-full rounded-2xl" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
            </div>
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <DeckContext.Provider value={cards}>
    <DeckActionsContext.Provider value={{ addWord: addWordFromReader }}>
    <div className="isolate min-h-screen bg-background flex flex-col lg:ps-60">
      <AppBackground />
      <SessionSummaryDialog summary={summary} onClose={closeSummary} onUseBackground={(id) => void setBackground(id)} />
      {/* Phone and tablet header; on a laptop the sidebar carries all of this. */}
      <header className="border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-10 lg:hidden">
        <div className="mx-auto px-4 py-4 flex items-center justify-between w-full max-w-lg">
          <button
            onClick={() => selectTab('home')}
            aria-label="Wazn — go to Home"
            className="flex items-center text-primary"
          >
            <WaznLogo size={28} wordmark />
          </button>
          <div className="flex items-center gap-3">
            {(!online || pendingCount > 0) && (
              <span
                className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                title={
                  online
                    ? `${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to sync`
                    : 'Offline — your work is saved on this device and syncs when you reconnect'
                }
              >
                <CloudOff className="w-3.5 h-3.5" />
                <span>{online ? `${pendingCount} to sync` : 'Offline'}</span>
              </span>
            )}
            <button
              onClick={goToDeck}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Layers className="w-4 h-4" />
              <span>{cards.length} words</span>
            </button>
          </div>
        </div>
      </header>

      <main className={`flex-1 mx-auto w-full px-4 pt-8 pb-28 max-w-lg lg:px-8 lg:pt-10 lg:pb-12 ${WIDE_VIEWS.has(view) ? 'lg:max-w-4xl' : 'lg:max-w-2xl'}`}>
        {view === 'home' && (
          <>
            {cards.length === 0 && user?.email && (
              <div className="rounded-xl border border-border/60 bg-muted/50 p-4 mb-5 text-sm text-muted-foreground space-y-1">
                <p className="text-foreground font-medium">This account has no cards yet.</p>
                <p>
                  You're signed in as <span className="text-foreground">{user.email}</span>. If your
                  words are on a different account, sign out and sign in with that email.
                </p>
              </div>
            )}
            <HomeDashboard
              userId={user?.id}
              dueCount={dueCount}
              nextWave={upcomingWave}
              recentCount={recentlyLearned.length}
              onPractice={startPractice}
              learnCount={learnCount}
              deckSize={cards.length}
              onReview={startReview}
              onLearn={() => { setTab('learn'); setView('learnCards'); }}
              onBrowseDecks={() => setView('learnDecks')}
              onContinueReading={continueReading}
              onBrowseLibrary={() => selectTab('library')}
              onSelectPractice={openLearnDestination}
              onOpenLevel={() => selectTab('settings')}
            />
          </>
        )}

        {view === 'learnHub' && (
          <LearnHub
            dueCount={dueCount}
            learnCount={learnCount}
            wordsWaiting={learnWaiting.words}
            sentencesWaiting={learnWaiting.sentences}
            sentencesOnly={sentencesOnly}
            onSentencesOnlyChange={setSentencesOnly}
            deckSize={cards.length}
            onSelect={openLearnDestination}
            onOpenPodcast={(p) => { setPodcast(p); setPodcastRegister(null); setView('podcast'); }}
          />
        )}

        {view === 'library' && (
          <Library
            resetToken={libraryReset}
            resumeToken={libraryResume}
            path={libraryPath}
            onPathChange={setLibraryPath}
          />
        )}

        {view === 'pdfToAudio' && <PdfToAudio onBack={() => setView('settings')} />}

        {view === 'learnDecks' && (
          <LearnDecks
            onBack={() => selectTab('home')}
            onBuildDeck={() => {
              setEditingDeck(null);
              setView('deckBuilder');
            }}
            onEditDeck={(deck) => {
              setEditingDeck(deck);
              setView('deckBuilder');
            }}
          />
        )}

        {view === 'deckBuilder' && (
          <DeckBuilder
            deck={editingDeck}
            admin={isDeckAdmin}
            onBack={() => setView('learnDecks')}
            onSaved={refetch}
          />
        )}

        {view === 'adminDecks' && <AdminDecks onBack={() => setView('settings')} />}

        {view === 'anki' && <AnkiTransfer cards={cards} onBack={() => setView('settings')} onImported={refetch} />}

        {view === 'importWords' && <ImportWords onBack={() => setView('settings')} />}

        {view === 'feedback' && <FeedbackForm onBack={() => setView('settings')} />}

        {view === 'settings' && (
          <SettingsScreen
            onOpenPdfToAudio={() => setView('pdfToAudio')}
            onOpenAddWords={() => setView('add')}
            onOpenImportWords={() => setView('importWords')}
            onOpenAnki={() => setView('anki')}
            onOpenAdminDecks={isDeckAdmin ? () => setView('adminDecks') : undefined}
            onOpenFeedback={() => setView('feedback')}
            email={user?.email}
            deckSize={cards.length}
            onSignOut={() => {
              // Back to the public front page, not a sign-in screen for /settings.
              window.history.replaceState(null, '', '/');
              return signOut();
            }}
            onOpenDeck={() => setView('deck')}
          />
        )}

        {view === 'add' && (
          <AddWords
            onAdd={handleAddWords}
            isLoading={isLoading}
            chapters={groups}
            onBack={() => setView('settings')}
          />
        )}

        {view === 'review' && !reviewDone && reviewItems[currentIndex] && (
          <div className="space-y-4">
            <BackButton onClick={() => selectTab('home')} label="Home" />
            {practising && (
              <p className="rounded-xl border border-border bg-card px-3 py-2 text-center text-xs text-muted-foreground">
                Practising this week&rsquo;s words. Nothing here changes when they next come up.
              </p>
            )}
            {reviewingSentence ? (
              <div className="space-y-3">
                <p className="text-center text-xs text-muted-foreground tabular-nums">
                  {currentIndex + 1} / {reviewItems.length}
                </p>
                <SentenceOrder
                  key={`${reviewItems[currentIndex].card.id}-${currentIndex}`}
                  card={reviewItems[currentIndex].card}
                  rounds={2}
                  onDone={(correct) => handleRate(correct ? 'good' : 'again')}
                />
              </div>
            ) : (
              <Flashcard
                card={reviewItems[currentIndex].card}
                direction={reviewItems[currentIndex].direction}
                onRate={handleRate}
                progress={{ current: currentIndex + 1, total: reviewItems.length, cards: new Set(reviewItems.map((i) => i.card.id)).size }}
                deck={cards}
              />
            )}
            {hasKeyboard && !reviewingSentence && (
              <button
                onClick={() => setFocusReview(true)}
                className="mx-auto block text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Press Enter for full screen — review with the arrow keys
              </button>
            )}
          </div>
        )}

        {focusReview && reviewing && (
          <FocusReview
            card={reviewItems[currentIndex].card}
            direction={reviewItems[currentIndex].direction}
            onRate={handleRate}
            progress={{ current: currentIndex + 1, total: reviewItems.length }}
            deck={cards}
            practising={practising}
            onExit={() => setFocusReview(false)}
          />
        )}

        {reviewDone && (
          <ReviewComplete reviewed={cardsCovered(reviewItems)} onDone={() => selectTab('home')} />
        )}

        {view === 'learnCards' && (
          <LearningMode
            cards={learnCards}
            allCards={cards}
            onUpdateCard={(id, updates) => handleUpdateCard(id, updates)}
            onBack={() => setView('learnHub')}
            onEarn={earn}
          />
        )}

        {view === 'deck' && (
          <DeckList
            cards={cards}
            onDelete={handleDelete}
            onUpdateCard={handleUpdateCard}
            // Back returns to the root of the tab the deck was opened from: Home's
            // header link used to drop you in the Learn tab instead.
            onBack={() => setView(tab === 'review' ? 'home' : TAB_HOME_VIEW[tab])}
            backLabel={tab === 'review' ? 'Home' : TAB_LABEL[tab]}
          />
        )}

        {view === 'conjugationDrill' && (
          <ConjugationDrill cards={studyCards} onBack={() => setView('learnHub')} />
        )}

        {view === 'prepositionDrill' && (
          <PrepositionDrill cards={studyCards} onBack={() => setView('learnHub')} />
        )}

        {view === 'numbersDrill' && (
          <NumbersDrill cards={studyCards} onBack={() => setView('learnHub')} />
        )}

        {view === 'lookup' && (
          <WordLookup
            deck={cards}
            onBack={() => setView('learnHub')}
          />
        )}

        {view === 'rootExplorer' && <RootExplorer cards={cards} onBack={() => setView('learnHub')} />}

        {view === 'verbForms' && <FormsTab onBack={() => setView('learnHub')} />}

        {view === 'memorize' && <MemorizeTranscript onBack={() => setView('learnHub')} />}

        {view === 'listenCards' && (
          <ListenToCards cards={cards} onBack={() => setView('learnHub')} />
        )}

        {view === 'podcast' && podcast && (
          <PodcastPlayer
            podcast={podcast}
            initialRegister={podcastRegister}
            onBack={() => { setPodcastRegister(null); setView('learnHub'); }}
          />
        )}
      </main>

      {showRelearnModal && (
        <RelearnModal
          cards={cards}
          onClose={() => setShowRelearnModal(false)}
          onStartRelearn={handleStartRelearn}
        />
      )}

      <BottomNav active={tab} onSelect={selectTab} dueCount={dueCount} />
      <SideNav
        active={tab}
        onSelect={selectTab}
        dueCount={dueCount}
        deckSize={cards.length}
        onOpenDeck={goToDeck}
        deckOpen={view === 'deck'}
        online={online}
        pendingCount={pendingCount}
      />
    </div>
    </DeckActionsContext.Provider>
    </DeckContext.Provider>
  );
};

export default Index;
