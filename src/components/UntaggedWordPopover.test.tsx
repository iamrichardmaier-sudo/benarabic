import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UntaggedWordPopover from './UntaggedWordPopover';
import { DeckActionsContext } from '@/contexts/DeckActionsContext';

describe('UntaggedWordPopover', () => {
  it('renders the word as a tappable trigger, not plain text', () => {
    render(<UntaggedWordPopover text="فيل" />);
    expect(screen.getByRole('button', { name: 'فيل' })).toBeInTheDocument();
  });

  it('says there is nothing recorded for it yet, on tap', async () => {
    const user = userEvent.setup();
    render(<UntaggedWordPopover text="فيل" />);
    await user.click(screen.getByRole('button', { name: 'فيل' }));
    expect(await screen.findByText('Nothing recorded for this word yet.')).toBeInTheDocument();
  });

  it('still offers to add the bare word to the deck, with no tag data to go on', async () => {
    const user = userEvent.setup();
    const addWord = vi.fn().mockResolvedValue(undefined);
    render(
      <DeckActionsContext.Provider value={{ addWord }}>
        <UntaggedWordPopover text="فيل" />
      </DeckActionsContext.Provider>,
    );
    await user.click(screen.getByRole('button', { name: 'فيل' }));
    const addBtn = await screen.findByRole('button', { name: /Add to my cards/ });
    // fireEvent rather than userEvent: Radix's popover dismiss-on-outside-click
    // layer treats userEvent's full pointerdown/mousedown/click sequence here
    // as an outside interaction and closes the popover before the button's
    // own onClick runs. A plain click event is what the handler actually
    // listens for, so this still exercises the real behavior.
    fireEvent.click(addBtn);
    expect(addWord).toHaveBeenCalledWith({
      word: 'فيل',
      english: null,
      root: null,
      wordType: null,
      verbForm: null,
    });
  });
});
