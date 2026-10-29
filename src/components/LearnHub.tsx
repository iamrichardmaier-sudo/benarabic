import {
  GraduationCap, BookOpen, RefreshCw, List,
  Sparkles, Link2, Brain, Headphones, ChevronRight, Search, Hash, LibraryBig, Network, Shapes, Boxes, type LucideIcon,
} from 'lucide-react';
import PodcastShelf from '@/components/podcasts/PodcastShelf';
import CardMixPicker from '@/components/CardMixPicker';
import { countKind, type CardMix } from '@/lib/learn-filter';
import type { Podcast } from '@/lib/podcasts';

export type LearnDestination =
  | 'learn' | 'review' | 'relearn' | 'deck' | 'lookup' | 'learnDecks'
  | 'conjugationDrill' | 'prepositionDrill' | 'numbersDrill'
  | 'memorize' | 'listenCards' | 'rootExplorer' | 'formExplorer' | 'verbForms';

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
const LearnHub = ({
  dueCount, dueSplit, learnCount, wordsWaiting = 0, sentencesWaiting = 0,
  cardMix = 'both', onCardMixChange, deckSize, onSelect, onOpenPodcast,
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

  const sections: { title: string; items: Item[] }[] = [
    {
      title: 'Flashcards',
      items: [
        {
          id: 'learn', label: 'Learn new words', icon: GraduationCap,
          hint: learnHint,
          disabled: learnCount === 0,
        },
        {
          id: 'review', label: 'Review', icon: BookOpen,
          hint: reviewHint,
          disabled: dueCount === 0,
        },
        {
          id: 'learnDecks', label: 'Learn Decks', icon: LibraryBig,
          hint: 'Chapter decks, or build your own',
        },
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
      title: 'Explore',
      items: [
        {
          id: 'rootExplorer', label: 'Browse by root', icon: Network,
          hint: 'Every word you hold on a root, and the verb forms it takes',
          disabled: deckSize === 0,
        },
        {
          id: 'formExplorer', label: 'Browse by form', icon: Boxes,
          hint: 'Every word in your deck built on Form I to Form X',
          disabled: deckSize === 0,
        },
      ],
    },
    {
      title: 'Grammar',
      items: [
        { id: 'verbForms', label: 'Verb forms', icon: Shapes, hint: 'Identify the ten forms and tell their meanings apart' },
        { id: 'conjugationDrill', label: 'Drill conjugations', icon: Sparkles, hint: "Practice a verb's past, present and verbal-noun forms" },
        { id: 'prepositionDrill', label: 'Drill prepositions', icon: Link2, hint: 'Verbs that always pair with one preposition' },
        { id: 'numbersDrill', label: 'Drill numbers and plurals', icon: Hash, hint: 'Counting — Arabic numbers change with the noun’s gender' },
      ],
    },
    {
      title: 'Memorization',
      items: [
        { id: 'memorize', label: 'Memorize a transcript', icon: Brain, hint: 'Hide words and recall the passage' },
        { id: 'listenCards', label: 'Listen to cards', icon: Headphones, hint: 'Play a set on a loop, hands-free' },
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
            {section.title === 'Flashcards' && showMix && onCardMixChange && (
              <div className="space-y-2 border-b border-border px-4 py-3.5">
                <span className="block">
                  <span className="block font-semibold text-foreground">Study</span>
                  <span className="block text-xs text-muted-foreground">
                    Vocab, sentences, or both — for Learn and Review
                  </span>
                </span>
                <CardMixPicker value={cardMix} onChange={onCardMixChange} />
              </div>
            )}
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

      <PodcastShelf onOpen={onOpenPodcast} />
    </div>
  );
};

export default LearnHub;
