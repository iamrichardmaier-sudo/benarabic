/**
 * Every screen of the signed-in app has its own address, so a refresh, a
 * bookmark or a shared link lands where it points, and the browser's Back
 * button walks the same path the in-app Back buttons do.
 *
 * The app still switches screens through one piece of state (see Index); this
 * module is only the two-way translation between that state and a URL path.
 * Paths never use the prefixes of the public reference pages (/word, /words,
 * /root, /roots, /form, /forms, /guide), which are static files on the server.
 */
import type { Tab } from '@/components/BottomNav';

export type View =
  | 'home' | 'learnHub' | 'library' | 'settings'
  | 'add' | 'review' | 'deck' | 'learnCards' | 'lookup'
  | 'conjugationDrill' | 'prepositionDrill' | 'numbersDrill' | 'translationPractice' | 'memorize' | 'listenCards' | 'rootExplorer' | 'formExplorer' | 'verbForms' | 'anki'
  | 'pdfToAudio' | 'dictionary'
  | 'learnDecks' | 'deckBuilder' | 'adminDecks' | 'importWords' | 'podcast' | 'feedback';

export interface AppLocation {
  tab: Tab;
  view: View;
  /** Inside the Library: e.g. "bible/John/3" (see library-path). */
  libraryPath?: string;
  /** The podcast open in the player. */
  podcastId?: string;
  /** Inside the dictionary: "" (search), "<word>" or "root/<root>". */
  dictPath?: string;
}

const PATHS: Record<Exclude<View, 'library' | 'podcast' | 'dictionary'>, string> = {
  home: '/',
  learnHub: '/learn',
  learnCards: '/learn/new-words',
  lookup: '/learn/lookup',
  rootExplorer: '/learn/roots',
  formExplorer: '/learn/forms',
  verbForms: '/learn/verb-forms',
  conjugationDrill: '/learn/conjugation',
  prepositionDrill: '/learn/prepositions',
  numbersDrill: '/learn/numbers',
  translationPractice: '/learn/translate',
  memorize: '/learn/memorize',
  listenCards: '/learn/listen',
  review: '/review',
  deck: '/deck',
  learnDecks: '/decks',
  deckBuilder: '/decks/build',
  settings: '/settings',
  add: '/settings/add-words',
  importWords: '/settings/import',
  anki: '/settings/anki',
  pdfToAudio: '/settings/pdf-to-audio',
  adminDecks: '/settings/admin-decks',
  feedback: '/settings/feedback',
};

const VIEW_BY_PATH = new Map(Object.entries(PATHS).map(([view, path]) => [path, view as View]));

function tabFor(path: string): Tab {
  if (path.startsWith('/learn')) return 'learn';
  if (path.startsWith('/library')) return 'library';
  if (path.startsWith('/settings')) return 'settings';
  if (path === '/review') return 'review';
  return 'home';
}

/** The address of a screen. */
export function pathFor(loc: AppLocation): string {
  if (loc.view === 'library') {
    const sub = (loc.libraryPath || '').replace(/^\/+|\/+$/g, '');
    return sub ? `/library/${sub}` : '/library';
  }
  if (loc.view === 'dictionary') {
    const sub = (loc.dictPath || '').replace(/^\/+|\/+$/g, '');
    return sub ? `/learn/dictionary/${sub.split('/').map(encodeURIComponent).join('/')}` : '/learn/dictionary';
  }
  if (loc.view === 'podcast') {
    return loc.podcastId ? `/learn/podcast/${encodeURIComponent(loc.podcastId)}` : '/learn';
  }
  return PATHS[loc.view];
}

/** The screen at an address, or null if it is not one of the app's. */
export function parsePath(pathname: string): AppLocation | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path === '/library' || path.startsWith('/library/')) {
    return { tab: 'library', view: 'library', libraryPath: decodeURIComponent(path.slice('/library/'.length)) };
  }
  if (path === '/learn/dictionary' || path.startsWith('/learn/dictionary/')) {
    const sub = path.slice('/learn/dictionary/'.length).split('/').map((x) => decodeURIComponent(x)).join('/');
    return { tab: 'learn', view: 'dictionary', dictPath: sub };
  }
  const podcast = path.match(/^\/learn\/podcast\/([^/]+)$/);
  if (podcast) return { tab: 'learn', view: 'podcast', podcastId: decodeURIComponent(podcast[1]) };
  const view = VIEW_BY_PATH.get(path);
  return view ? { tab: tabFor(path), view } : null;
}

/** True for any address the signed-in app answers. */
export function isAppPath(pathname: string): boolean {
  return parsePath(pathname) !== null;
}
