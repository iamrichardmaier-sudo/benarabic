import { describe, it, expect } from 'vitest';
import { pathFor, parsePath, isAppPath, type View } from './app-routes';

describe('app routes', () => {
  it('round-trips every screen', () => {
    const views: View[] = ['home', 'learnHub', 'learnCards', 'lookup', 'rootExplorer', 'verbForms',
      'conjugationDrill', 'prepositionDrill', 'numbersDrill', 'memorize', 'listenCards', 'review', 'deck',
      'learnDecks', 'deckBuilder', 'settings', 'add', 'importWords', 'anki', 'pdfToAudio', 'adminDecks', 'feedback'];
    for (const view of views) {
      const path = pathFor({ tab: 'home', view });
      expect(parsePath(path)?.view).toBe(view);
    }
  });

  it('puts each screen under its tab', () => {
    expect(parsePath('/learn/roots')?.tab).toBe('learn');
    expect(parsePath('/settings/anki')?.tab).toBe('settings');
    expect(parsePath('/review')?.tab).toBe('review');
    expect(parsePath('/deck')?.tab).toBe('home');
    expect(parsePath('/')?.tab).toBe('home');
  });

  it('carries the place inside the Library', () => {
    expect(pathFor({ tab: 'library', view: 'library', libraryPath: 'bible/John/3' })).toBe('/library/bible/John/3');
    expect(parsePath('/library/bible/John/3')).toEqual({ tab: 'library', view: 'library', libraryPath: 'bible/John/3' });
    expect(parsePath('/library')).toEqual({ tab: 'library', view: 'library', libraryPath: '' });
  });

  it('addresses the dictionary, its words and its roots', () => {
    expect(pathFor({ tab: 'learn', view: 'dictionary' })).toBe('/learn/dictionary');
    expect(pathFor({ tab: 'learn', view: 'dictionary', dictPath: 'kitab' })).toBe('/learn/dictionary/kitab');
    expect(parsePath('/learn/dictionary/kitab/')).toEqual({ tab: 'learn', view: 'dictionary', dictPath: 'kitab' });
    const root = pathFor({ tab: 'learn', view: 'dictionary', dictPath: 'root/ك-ت-ب' });
    expect(root).toBe(`/learn/dictionary/root/${encodeURIComponent('ك-ت-ب')}`);
    expect(parsePath(root)).toEqual({ tab: 'learn', view: 'dictionary', dictPath: 'root/ك-ت-ب' });
  });

  it('addresses a podcast by id', () => {
    expect(pathFor({ tab: 'learn', view: 'podcast', podcastId: 'abc' })).toBe('/learn/podcast/abc');
    expect(parsePath('/learn/podcast/abc')).toEqual({ tab: 'learn', view: 'podcast', podcastId: 'abc' });
  });

  it('ignores trailing slashes and rejects unknown or public-site paths', () => {
    expect(parsePath('/learn/')?.view).toBe('learnHub');
    expect(isAppPath('/word/kitab/')).toBe(false);
    expect(isAppPath('/roots/')).toBe(false);
    expect(isAppPath('/nope')).toBe(false);
  });
});
