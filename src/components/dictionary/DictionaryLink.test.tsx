import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DeckActionsContext } from '@/contexts/DeckActionsContext';
import DictionaryLink from './DictionaryLink';

const renderLink = (openDictionary = vi.fn()) => {
  render(
    <DeckActionsContext.Provider value={{ openDictionary }}>
      <DictionaryLink word="كِتَاب" />
    </DeckActionsContext.Provider>,
  );
  return { openDictionary, link: screen.getByRole('link', { name: /Open in dictionary/ }) };
};

describe('Open in dictionary', () => {
  it('is a real link to the word in the dictionary', () => {
    const { link } = renderLink();
    expect(link).toHaveAttribute('href', `/learn/dictionary/${encodeURIComponent('كِتَاب')}`);
  });

  it('opens in the app on a plain click', () => {
    const { link, openDictionary } = renderLink();
    fireEvent.click(link);
    expect(openDictionary).toHaveBeenCalledWith({ word: 'كِتَاب' });
  });

  it('leaves Ctrl- and Cmd-click to the browser, which opens a new tab', () => {
    const { link, openDictionary } = renderLink();
    expect(fireEvent.click(link, { ctrlKey: true })).toBe(true); // not prevented
    expect(fireEvent.click(link, { metaKey: true })).toBe(true);
    expect(openDictionary).not.toHaveBeenCalled();
  });

  it('is not shown where there is no app around it', () => {
    render(<DictionaryLink word="كِتَاب" />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
