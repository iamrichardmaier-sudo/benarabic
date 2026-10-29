import type { ReactNode } from 'react';
import {
  GraduationCap, BookOpen, RefreshCw, List, BookA,
  Sparkles, Link2, Brain, Headphones, Hash, LibraryBig, Network, Shapes, Boxes, type LucideIcon,
} from 'lucide-react';
import PodcastShelf from '@/components/podcasts/PodcastShelf';
import CardMixPicker from '@/components/CardMixPicker';
import HubTile from '@/components/learn/HubTile';
import { countKind, type CardMix } from '@/lib/learn-filter';
import type { Podcast } from '@/lib/podcasts';

export type LearnDestination =
  | 'learn' | 'review' | 'relearn' | 'deck' | 'lookup' | 'learnDecks'
  | 'conjugationDrill' | 'prepositionDrill' | 'numbersDrill'
  | 'memorize' | 'listenCards' | 'rootExplorer' | 'formExplorer' | 'verbForms' | 'dictionary';

interface LearnHubProps {
  dueCount: number;
  /** How the due cards split, so Review can say what the chosen mix holds. */
  dueSplit?: { words: number; sentences: number };
  /** What Learn opens on right now — all that is waiting, or just one kind. */
  learnCount: number;
  /** Single words waiting to be learned. */
  wordsWaiting?: number;
  /** Sentence cards waiting to be learned. */
  sentencesWaiting?: number;
  /** Study vocab, sentences or both — in Learn and Review alike. */
  cardMix?: CardMix;
  onCardMixChange?: (mix: CardMix) => void;
  deckSize: number;
  onSelect: (destination: LearnDestination) => void;
  /** Opens a podcast from the shelf at the foot of the screen. */
  onOpenPodcast: (podcast: Podcast) => void;
  /** The search field, set under the title. */
  search?: ReactNode;
}

interface Tool {
  id: LearnDestination;
  label: string;
  hint: string;
  icon: LucideIcon;
  disabled?: boolean;
  disabledHint?: string;
}

const NEEDS_WORDS = 'Add some words first';

/**
 * Everything that is practice rather than reading, in order of how often it
 * is reached for. Today's two sessions come first and largest, since they are
 * the daily habit; then the tools for the words themselves; then the drills,
 * grouped, as an even grid. Reading lives in Library; this screen never opens
 * a text for its own sake.
 */
const LearnHub = ({
  dueCount, dueSplit, learnCount, wordsWaiting = 0, sentencesWaiting = 0,
  cardMix = 'both', onCardMixChange, deckSize, onSelect, onOpenPodcast, search,
}: LearnHubProps) => {
  const anySentences = sentencesWaiting > 0 || (dueSplit?.sentences ?? 0) > 0;
  // Offered whenever there are sentences to study, and kept while a filter is
  // on so it can always be turned off — a control that vanished while set
  // would strand the learner on an empty queue.
  const showMix = Boolean(onCardMixChange) && (anySentences || cardMix !== 'both');
  const learnHint = learnCount === 0
    ? (cardMix === 'sentences' ? 'No sentences waiting'
      : cardMix === 'words' ? 'No vocab waiting'
      : 'Nothing new right now')
    : cardMix !== 'both'
      ? `${countKind(learnCount, cardMix)} waiting`
      : sentencesWaiting > 0
        ? `${countKind(wordsWaiting, 'words')} · ${countKind(sentencesWaiting, 'sentences')} waiting`
        : `${learnCount} waiting`;
  const dueInMix = cardMix !== 'both' && dueSplit ? dueSplit[cardMix] : dueCount;
  const reviewHint = dueCount === 0
    ? 'All caught up'
    : cardMix !== 'both' && dueSplit
      ? `${countKind(dueInMix, cardMix)} due${dueInMix < dueCount ? ` · ${dueCount} in all` : ''}`
      : `${dueCount} due`;
  const empty = deckSize === 0;

  const yourWords: Tool[] = [
    { id: 'deck', label: 'My deck', icon: List, hint: `${deckSize} word${deckSize === 1 ? '' : 's'}` },
    { id: 'learnDecks', label: 'Decks', icon: LibraryBig, hint: 'Chapter decks' },
    { id: 'dictionary', label: 'Dictionary', icon: BookA, hint: '27,000 words' },
    { id: 'relearn', label: 'Relearn', icon: RefreshCw, hint: 'Reset cards', disabled: empty, disabledHint: 'No cards yet' },
  ];

  const practice: { title: string; tools: Tool[] }[] = [
    {
      title: 'Grammar',
      tools: [
        { id: 'verbForms', label: 'Verb forms', icon: Shapes, hint: 'Identify the ten forms and tell their meanings apart' },
        { id: 'conjugationDrill', label: 'Conjugations', icon: Sparkles, hint: "A verb's past, present and verbal noun" },
        { id: 'prepositionDrill', label: 'Prepositions', icon: Link2, hint: 'Verbs that always pair with one preposition' },
        { id: 'numbersDrill', label: 'Numbers & plurals', icon: Hash, hint: 'Counting, as the noun’s gender changes it' },
      ],
    },
    {
      // Four to a row on every screen: two rows of two on a phone, one row on
      // a laptop, so no row is left half empty.
      title: 'Explore & memorize',
      tools: [
        { id: 'rootExplorer', label: 'By root', icon: Network, hint: 'Every word you hold on a root', disabled: empty, disabledHint: NEEDS_WORDS },
        { id: 'formExplorer', label: 'By form', icon: Boxes, hint: 'Your words from Form I to Form X', disabled: empty, disabledHint: NEEDS_WORDS },
        { id: 'memorize', label: 'A transcript', icon: Brain, hint: 'Hide words and recall the passage' },
        { id: 'listenCards', label: 'Listen', icon: Headphones, hint: 'Play a set on a loop, hands-free' },
      ],
    },
  ];

  const heading = (text: string) => (
    <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{text}</h2>
  );

  return (
    <div className="space-y-7">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Learn</h1>
        <p className="text-sm text-muted-foreground">Today’s cards, your words, and every drill.</p>
      </div>

      {search}

      <section className="space-y-3" aria-label="Today">
        {heading('Today')}
        <div className="grid grid-cols-2 gap-3">
          <HubTile
            variant="feature"
            icon={BookOpen}
            label="Review"
            // The figure already says how many; the line under it says what of.
            hint={reviewHint === `${dueCount} due` ? 'cards due today' : reviewHint}
            figure={String(dueCount === 0 ? 0 : dueInMix)}
            onClick={() => onSelect('review')}
            disabled={dueCount === 0}
            emphasis
          />
          <HubTile
            variant="feature"
            icon={GraduationCap}
            label="Learn new words"
            hint={learnHint}
            figure={String(learnCount)}
            onClick={() => onSelect('learn')}
            disabled={learnCount === 0}
            emphasis={dueCount === 0}
          />
        </div>
        {showMix && onCardMixChange && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border bg-card px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">Study</span>
              <span className="block text-xs text-muted-foreground">Vocab, sentences, or both — for Learn and Review</span>
            </span>
            <CardMixPicker value={cardMix} onChange={onCardMixChange} className="w-full sm:w-72" />
          </div>
        )}
      </section>

      <section className="space-y-3" aria-label="Your words">
        {heading('Your words')}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {yourWords.map((t) => (
            <HubTile key={t.id} variant="compact" {...t} onClick={() => onSelect(t.id)} />
          ))}
        </div>
      </section>

      <section className="space-y-5" aria-label="Practice">
        {practice.map((group) => (
          <div key={group.title} className="space-y-3">
            {heading(group.title)}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {group.tools.map((t) => (
                <HubTile key={t.id} {...t} onClick={() => onSelect(t.id)} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <PodcastShelf onOpen={onOpenPodcast} />
    </div>
  );
};

export default LearnHub;
