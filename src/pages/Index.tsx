import { useState, useCallback, useEffect, useRef } from 'react';
import { BookOpen, Plus, Layers, List, GraduationCap, LogOut, RefreshCw, CloudOff } from 'lucide-react';
import AddWords from '@/components/AddWords';
import Flashcard, { ReviewDirection } from '@/components/Flashcard';
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
import WordLookup from '@/components/WordLookup';
import { entryToCardFields, type DictionaryEntry } from '@/lib/dictionary';
import Library from '@/components/library/Library';
import HomeDashboard from '@/components/HomeDashboard';
import LearnHub, { type LearnDestination } from '@/components/LearnHub';
import SettingsScreen from '@/components/SettingsScreen';
import PdfToAudio from '@/components/PdfToAudio';
import LearnDecks from '@/components/decks/LearnDecks';
import DeckBuilder from '@/components/decks/DeckBuilder';
import AdminDecks from '@/components/decks/AdminDecks';
import ImportWords from '@/components/decks/ImportWords';
import { useDeckLibrary } from '@/hooks/useDeckLibrary';
import type { Deck } from '@/lib/deck-store';
import BottomNav, { type Tab } from '@/components/BottomNav';
import BackButton from '@/components/BackButton';
import WaznLogo from '@/components/WaznLogo';
import { recordStudyDay } from '@/lib/streak';
import { FlashCard, Rating, createCard, reviewCard, getDueCards, getLearnableCards, parseWordLine, scheduleFields, nextWave } from '@/lib/spaced-repetition';
import { queueAfterGrade, cardsCovered } from '@/lib/review-queue';
import { learnedRecently, RECENT_DAYS } from '@/lib/recent-words';
import { DeckActionsContext, type NewWord } from '@/contexts/DeckActionsContext';
import { useFlashcards } from '@/hooks/useFlashcards';
import { useAuth } from '@/hooks/useAuth';
import { searchImage, backfillMissingImages } from '@/lib/unsplash';
import { tagCards, tagUntaggedDeck, repairVerbMasdarPairs } from '@/lib/auto-tag-deck';
import { markNeedsImage } from '@/lib/offline-cache';
import GroupFilter from '@/components/GroupFilter';
import type { TaggedImportEntry } from '@/lib/import-tagged';
import { useToast } from '@/hooks/use-toast';

/** A tab's root screen, plus every screen reachable beneath it. */
type View =
  | 'home' | 'learnHub' | 'library' | 'settings'
  | 'add' | 'review' | 'deck' | 'learnCards' | 'lookup'
  | 'conjugationDrill' | 'prepositionDrill' | 'numbersDrill' | 'memorize'
  | 'pdfToAudio'
  | 'learnDecks' | 'deckBuilder' | 'adminDecks' | 'importWords';

const ACTIVE_GROUP_KEY = 'arabic-flashcards-active-group';

function readActiveGroup(): string | null {
  try {
    return localStorage.getItem(ACTIVE_GROUP_KEY);
  } catch {
    return null;
  }
}

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
  const [tab, setTab] = useState<Tab>('home');
  const [view, setView] = useState<View>('home');
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
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showRelearnModal, setShowRelearnModal] = useState(false);
  // Bumped to tell the Library to return to its root, or to open the stored
  // reading position — both are actions only the Library can carry out.
  const [libraryReset, setLibraryReset] = useState(0);
  const [libraryResume, setLibraryResume] = useState(0);
  const { toast } = useToast();
  const { admin: isDeckAdmin } = useDeckLibrary();
  const backfillRan = useRef(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(readActiveGroup);

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
      const newCards: FlashCard[] = [];
      let imageError: string | null = null;
      let imagesDeferred = false;
      for (const line of lines) {
        const entries = parseWordLine(line);
        for (const { fusha, shaami, english } of entries) {
          if (!fusha) continue;
          const searchQuery = english || fusha;
          const { imageUrl, error, deferred } = await searchImage(searchQuery);
          if (error && !imageError) imageError = error;
          if (deferred) imagesDeferred = true;
          newCards.push({ ...createCard(fusha, english, imageUrl, shaami), group: chapter || null });
        }
      }
      await addCards(newCards);
      if (imagesDeferred) markNeedsImage(user?.id, newCards.map((c) => c.id));
      const found = newCards.filter((c) => c.imageUrl).length;
      toast({
        title: `Added ${newCards.length} word${newCards.length > 1 ? 's' : ''}`,
        description: imagesDeferred
          ? 'Saved on this device — pictures and tags fill in when you reconnect.'
          : imageError
            ? `${found} images found — image lookup failed for the rest: ${imageError}`
            : `${found} images found`,
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

  /** Tapping a tab always returns to that section's root, including the tab
   *  you are already on — the standard "tap again to go back up" shortcut. */
  const selectTab = (next: Tab) => {
    // Re-tapping Library while already there means "back to the top of the
    // Library", which only the Library itself can act on — hence the token.
    if (next === 'library' && tab === 'library') setLibraryReset((n) => n + 1);
    setTab(next);
    if (next === 'review') return startReview();
    setView(TAB_HOME_VIEW[next]);
  };

  const goToDeck = () => {
    setTab('settings');
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
    setLibraryResume((n) => n + 1);
  };

  const chooseGroup = (group: string | null) => {
    setActiveGroup(group);
    try {
      if (group === null) localStorage.removeItem(ACTIVE_GROUP_KEY);
      else localStorage.setItem(ACTIVE_GROUP_KEY, group);
    } catch {
      /* the choice just will not persist */
    }
  };

  const groups = [...new Set(cards.map((c) => c.group).filter((g): g is string => !!g))].sort();
  const groupCounts = groups.reduce<Record<string, number>>((acc, g) => {
    acc[g] = cards.filter((c) => c.group === g).length;
    return acc;
  }, {});
  // A filter naming a group that no longer exists would silently hide the whole
  // deck, so fall back to everything.
  const effectiveGroup = activeGroup && groups.includes(activeGroup) ? activeGroup : null;
  /** What the study modes work from. The Deck view still lists everything. */
  const studyCards = effectiveGroup ? cards.filter((c) => c.group === effectiveGroup) : cards;

  /**
   * Review is deliberately global: the spaced-repetition schedule is a promise
   * about the whole deck, so a card falling due must not be hidden just because
   * a chapter filter happens to be set. Learning new words still respects the
   * filter — that is a choice about what to study next, not a debt already owed.
   */
  const openSession = (pool: FlashCard[], practice: boolean) => {
    const items: { card: FlashCard; direction: ReviewDirection }[] = [];
    for (const card of pool) {
      items.push({ card, direction: 'ar-to-en' });
      items.push({ card, direction: 'en-to-ar' });
    }
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    setPractising(practice);
    setReviewItems(items);
    setCurrentIndex(0);
    setView('review');
  };

  const startReview = () => openSession(getDueCards(cards), false);

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
      await addCards([
        {
          ...createCard(word.word, word.english ?? null, null, null),
          root: word.root ?? null,
          wordType: (word.wordType as FlashCard['wordType']) ?? null,
          verbForm: (word.verbForm as FlashCard['verbForm']) ?? null,
          wordVoweled: word.word,
        },
      ]);
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
      await addCards([
        {
          ...createCard(fields.word, fields.english, null, null),
          root: fields.root,
          wordType: fields.wordType,
          verbForm: fields.verbForm,
          wordVoweled: fields.word,
          taggedAt: new Date().toISOString(),
        },
      ]);
      toast({ title: `Added ${fields.word}` });
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
  const learnCount = getLearnableCards(studyCards).length;
  const reviewDone = view === 'review' && currentIndex >= reviewItems.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Loading your flashcards...
      </div>
    );
  }

  return (
    <DeckContext.Provider value={cards}>
    <DeckActionsContext.Provider value={{ addWord: addWordFromReader }}>
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
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
        {/* The group filter narrows study, so it only belongs on study screens. */}
        {tab === 'learn' && view !== 'memorize' && groups.length > 0 && (
          <div className="max-w-lg mx-auto px-4 pb-3">
            <GroupFilter
              groups={groups}
              active={effectiveGroup}
              onChange={chooseGroup}
              counts={groupCounts}
              totalCount={cards.length}
              compact
            />
          </div>
        )}
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-8 pb-28">
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
            />
          </>
        )}

        {view === 'learnHub' && (
          <LearnHub
            dueCount={dueCount}
            learnCount={learnCount}
            deckSize={cards.length}
            onSelect={openLearnDestination}
          />
        )}

        {view === 'library' && (
          <Library resetToken={libraryReset} resumeToken={libraryResume} />
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

        {view === 'importWords' && <ImportWords onBack={() => setView('settings')} />}

        {view === 'settings' && (
          <SettingsScreen
            onOpenPdfToAudio={() => setView('pdfToAudio')}
            onOpenAddWords={() => setView('add')}
            onOpenImportWords={() => setView('importWords')}
            onOpenAdminDecks={isDeckAdmin ? () => setView('adminDecks') : undefined}
            email={user?.email}
            deckSize={cards.length}
            onSignOut={signOut}
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
            <Flashcard
              card={reviewItems[currentIndex].card}
              direction={reviewItems[currentIndex].direction}
              onRate={handleRate}
              progress={{ current: currentIndex + 1, total: reviewItems.length }}
              deck={cards}
            />
          </div>
        )}

        {reviewDone && (
          <ReviewComplete reviewed={cardsCovered(reviewItems)} onDone={() => selectTab('home')} />
        )}

        {view === 'learnCards' && (
          <LearningMode
            cards={getLearnableCards(studyCards)}
            allCards={cards}
            onUpdateCard={(id, updates) => handleUpdateCard(id, updates)}
            onBack={() => setView('learnHub')}
          />
        )}

        {view === 'deck' && (
          <DeckList
            cards={cards}
            onDelete={handleDelete}
            onUpdateCard={handleUpdateCard}
            onBack={() => setView(tab === 'settings' ? 'settings' : 'learnHub')}
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

        {view === 'memorize' && <MemorizeTranscript onBack={() => setView('learnHub')} />}
      </main>

      {showRelearnModal && (
        <RelearnModal
          cards={cards}
          onClose={() => setShowRelearnModal(false)}
          onStartRelearn={handleStartRelearn}
        />
      )}

      <BottomNav active={tab} onSelect={selectTab} dueCount={dueCount} />
    </div>
    </DeckActionsContext.Provider>
    </DeckContext.Provider>
  );
};

export default Index;
