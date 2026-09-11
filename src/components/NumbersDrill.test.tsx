import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NumbersDrill from './NumbersDrill';
import type { FlashCard } from '@/lib/spaced-repetition';

const book = {
  id: '1', word: 'كتاب', wordVoweled: 'كِتاب', english: 'book',
  wordType: 'noun', fushaPlural: 'كُتُب', gender: 'm', root: 'ك-ت-ب',
} as FlashCard;

const magazine = {
  id: '2', word: 'مجلة', wordVoweled: 'مَجَلّة', english: 'magazine',
  wordType: 'noun', fushaPlural: 'مَجَلّات', gender: 'f',
} as FlashCard;

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as { visualViewport?: unknown }).visualViewport;
});

/** Pretend a finger, so the tap-to-continue shortcut is offered. */
function useFinger() {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('coarse'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

/** Pretend the on-screen keyboard is covering the lower half of the screen. */
function raiseKeyboard() {
  (window as { visualViewport?: unknown }).visualViewport = {
    height: window.innerHeight - 300,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

/** Gets to a question with only the 3–10 range on. */
async function toQuestion(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('1–2'));
  await user.click(screen.getByText('11–99'));
  await user.click(screen.getByRole('button', { name: 'Start' }));
}

/** Pins the noun and the number so a round can be asserted on. */
function startWith(cards: FlashCard[]) {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  return render(<NumbersDrill cards={cards} onBack={() => {}} />);
}

describe('NumbersDrill setup', () => {
  it('says so when no noun can be counted yet', () => {
    render(<NumbersDrill cards={[{ ...book, fushaPlural: null }]} onBack={() => {}} />);
    expect(screen.getByText(/No nouns ready to drill/i)).toBeInTheDocument();
  });

  it('offers a box per rule, not per round number', () => {
    render(<NumbersDrill cards={[book]} onBack={() => {}} />);
    expect(screen.getByText('3–10')).toBeInTheDocument();
    expect(screen.getByText(/the numeral flips gender/i)).toBeInTheDocument();
    expect(screen.getByText('10,000–1,000,000')).toBeInTheDocument();
  });

  it('will not start with every box cleared', async () => {
    const user = userEvent.setup();
    render(<NumbersDrill cards={[book]} onBack={() => {}} />);
    for (const label of ['1–2', '3–10', '11–99']) {
      await user.click(screen.getByText(label));
    }
    expect(screen.getByRole('button', { name: /Pick at least one range/i })).toBeDisabled();
  });
});

describe('NumbersDrill rounds', () => {
  it('marks the reversed numeral and the plural noun right', async () => {
    // Math.random pinned to 0 gives the first range (1–2 is off, so 3–10)
    // at its minimum: three books.
    const user = userEvent.setup();
    startWith([book]);
    await user.click(screen.getByText('1–2'));
    await user.click(screen.getByText('11–99'));
    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(screen.getByText('٣')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/The number, in words/i), 'ثلاثة');
    await user.type(screen.getByLabelText(/The noun/i), 'كتب');
    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(screen.getByText('1/1')).toBeInTheDocument();
    expect(screen.getByText(/flips to the opposite gender/i)).toBeInTheDocument();
  });

  it('marks an unreversed numeral wrong and shows what was wanted', async () => {
    const user = userEvent.setup();
    startWith([book]);
    await user.click(screen.getByText('1–2'));
    await user.click(screen.getByText('11–99'));
    await user.click(screen.getByRole('button', { name: 'Start' }));

    // ثلاث is the feminine-noun form; كِتاب is masculine, so it needs the ة.
    await user.type(screen.getByLabelText(/The number, in words/i), 'ثلاث');
    await user.type(screen.getByLabelText(/The noun/i), 'كتب');
    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(screen.getByText('0/1')).toBeInTheDocument();
    expect(screen.getAllByText('ثلاثة').length).toBeGreaterThan(0);
  });

  it('reverses the other way for a feminine noun', async () => {
    const user = userEvent.setup();
    startWith([magazine]);
    await user.click(screen.getByText('1–2'));
    await user.click(screen.getByText('11–99'));
    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(screen.getByText('feminine')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/The number, in words/i), 'ثلاث');
    await user.type(screen.getByLabelText(/The noun/i), 'مجلات');
    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(screen.getByText('1/1')).toBeInTheDocument();
  });

  it('gives the noun a hover panel with its definition and tags', async () => {
    const user = userEvent.setup();
    startWith([book]);
    await user.click(screen.getByText('1–2'));
    await user.click(screen.getByText('11–99'));
    await user.click(screen.getByRole('button', { name: 'Start' }));

    // The word sits inside the popover's trigger, so hover the trigger itself
    // rather than the span holding the text.
    const trigger = screen.getByText('كِتاب').closest('[aria-haspopup]');
    await user.hover(trigger as Element);
    expect(await screen.findByText('ك-ت-ب')).toBeInTheDocument();
    expect(screen.getByText('كُتُب')).toBeInTheDocument();
  });

  it('moves to the noun box when Enter is pressed with it still empty', async () => {
    const user = userEvent.setup();
    startWith([book]);
    await toQuestion(user);

    const numberBox = screen.getByLabelText(/The number, in words/i);
    await user.type(numberBox, 'ثلاثة{Enter}');
    expect(screen.getByLabelText(/The noun/i)).toHaveFocus();
  });

  it('checks on Enter once both boxes are filled', async () => {
    const user = userEvent.setup();
    startWith([book]);
    await toQuestion(user);

    await user.type(screen.getByLabelText(/The number, in words/i), 'ثلاثة');
    await user.type(screen.getByLabelText(/The noun/i), 'كتب{Enter}');
    expect(screen.getByText('1/1')).toBeInTheDocument();
  });

  it('goes back to the number box from an empty one, rather than checking half an answer', async () => {
    const user = userEvent.setup();
    startWith([book]);
    await toQuestion(user);

    await user.type(screen.getByLabelText(/The noun/i), 'كتب{Enter}');
    expect(screen.getByLabelText(/The number, in words/i)).toHaveFocus();
    expect(screen.getByText('0/0')).toBeInTheDocument();
  });

  it('moves on when Enter is pressed on the answer, with nothing focused', async () => {
    // Checking blurs the boxes so the phone keyboard drops, which takes Enter
    // out of the inputs' reach — the window listens for it instead.
    const user = userEvent.setup();
    startWith([book]);
    await toQuestion(user);

    await user.type(screen.getByLabelText(/The number, in words/i), 'ثلاثة');
    await user.type(screen.getByLabelText(/The noun/i), 'كتب{Enter}');
    expect(screen.getByText('1/1')).toBeInTheDocument();

    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: /Check/ })).toBeInTheDocument();
  });
});

describe('NumbersDrill on a phone', () => {
  it('offers the tap shortcut only to a finger', async () => {
    const user = userEvent.setup();
    startWith([book]);
    await toQuestion(user);
    await user.type(screen.getByLabelText(/The number, in words/i), 'ثلاثة');
    await user.type(screen.getByLabelText(/The noun/i), 'كتب{Enter}');
    // No coarse pointer stubbed, so this is a mouse: it is told about Enter,
    // not about tapping.
    expect(screen.queryByText(/tap the left/i)).not.toBeInTheDocument();
    expect(screen.getByText(/press Enter/i)).toBeInTheDocument();
  });

  it('gives back the card’s height when the keyboard comes up', async () => {
    // The English line is the one thing on the card that the answer does not
    // depend on, so it is what goes when the room runs out.
    raiseKeyboard();
    const user = userEvent.setup();
    startWith([book]);
    await toQuestion(user);
    expect(screen.queryByText('book')).not.toBeInTheDocument();
    // The gender stays: it is what the numeral has to agree with.
    expect(screen.getByText('masculine')).toBeInTheDocument();
  });

  it('keeps the word, the number, both boxes and the button on screen', async () => {
    raiseKeyboard();
    const user = userEvent.setup();
    startWith([book]);
    await toQuestion(user);
    expect(screen.getByText('كِتاب')).toBeInTheDocument();
    expect(screen.getByText('٣')).toBeInTheDocument();
    expect(screen.getByLabelText(/The number, in words/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/The noun/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check' })).toBeInTheDocument();
  });

  it('moves on when the left of the screen is tapped', async () => {
    useFinger();
    const user = userEvent.setup();
    startWith([book]);
    await toQuestion(user);
    await user.type(screen.getByLabelText(/The number, in words/i), 'ثلاثة');
    await user.type(screen.getByLabelText(/The noun/i), 'كتب{Enter}');
    expect(screen.getByText(/tap the left/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('٣'), { clientX: 10 });
    expect(screen.getByRole('button', { name: 'Check' })).toBeInTheDocument();
  });

  it('does not move on from a tap on the right', async () => {
    useFinger();
    const user = userEvent.setup();
    startWith([book]);
    await toQuestion(user);
    await user.type(screen.getByLabelText(/The number, in words/i), 'ثلاثة');
    await user.type(screen.getByLabelText(/The noun/i), 'كتب{Enter}');

    fireEvent.click(screen.getByText('٣'), { clientX: window.innerWidth - 10 });
    expect(screen.queryByRole('button', { name: 'Check' })).not.toBeInTheDocument();
  });

  it('advances once when the Next button is tapped, not twice', async () => {
    // The button is full width, so its left half sits in the tap zone. Without
    // the exclusion the button's own handler and the tap handler both fire and
    // a question is skipped unseen.
    useFinger();
    let call = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      call++;
      // Two calls pick the number, the third picks the noun — alternate it so
      // consecutive questions are told apart.
      if (call % 3 === 0) return (call / 3) % 2 === 1 ? 0 : 0.99;
      return 0;
    });

    const user = userEvent.setup();
    render(<NumbersDrill cards={[book, magazine]} onBack={() => {}} />);
    await toQuestion(user);
    expect(screen.getByText('كِتاب')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/The number, in words/i), 'ثلاثة');
    await user.type(screen.getByLabelText(/The noun/i), 'كتب{Enter}');
    fireEvent.click(screen.getByRole('button', { name: /Next/ }), { clientX: 10 });

    // The second question, not the third.
    expect(screen.getByText('مَجَلّة')).toBeInTheDocument();
  });

  it('advances once when Enter is pressed on the focused Next button', async () => {
    // The button acts on Enter itself; the window listener must stand back or
    // the two together skip a question.
    let call = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      call++;
      if (call % 3 === 0) return (call / 3) % 2 === 1 ? 0 : 0.99;
      return 0;
    });

    const user = userEvent.setup();
    render(<NumbersDrill cards={[book, magazine]} onBack={() => {}} />);
    await toQuestion(user);
    expect(screen.getByText('كِتاب')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/The number, in words/i), 'ثلاثة');
    await user.type(screen.getByLabelText(/The noun/i), 'كتب{Enter}');

    screen.getByRole('button', { name: /Next/ }).focus();
    await user.keyboard('{Enter}');

    // The second question, not the third.
    expect(screen.getByText('مَجَلّة')).toBeInTheDocument();
  });

  it('puts the cursor in the first box on starting, so the keyboard comes up', async () => {
    const user = userEvent.setup();
    startWith([book]);
    await toQuestion(user);
    expect(screen.getByLabelText(/The number, in words/i)).toHaveFocus();
  });

  it('puts the cursor back in the first box on the next question', async () => {
    // iOS raises the keyboard only for a focused, editable input, and only
    // inside the gesture that asked — so the focus landing here is what makes
    // the keyboard appear on the phone.
    const user = userEvent.setup();
    startWith([book]);
    await toQuestion(user);
    await user.type(screen.getByLabelText(/The number, in words/i), 'ثلاثة');
    await user.type(screen.getByLabelText(/The noun/i), 'كتب{Enter}');

    await user.keyboard('{Enter}');
    expect(screen.getByLabelText(/The number, in words/i)).toHaveFocus();
  });

  it('makes the box editable again once the answer is dismissed', async () => {
    // Safari will not show the keyboard for a read-only input, and the box is
    // read-only while the answer is up — hence the flushSync before focus in
    // `advance`, so the DOM is updated before the cursor lands and while still
    // inside the gesture. This test cannot pin that ordering: act() flushes
    // before any assertion can run, so jsdom sees the settled state either
    // way. What it does catch is the box staying read-only altogether.
    const user = userEvent.setup();
    startWith([book]);
    await toQuestion(user);
    await user.type(screen.getByLabelText(/The number, in words/i), 'ثلاثة');
    await user.type(screen.getByLabelText(/The noun/i), 'كتب{Enter}');
    expect(screen.getByLabelText(/The number, in words/i)).toHaveAttribute('readonly');

    await user.keyboard('{Enter}');
    expect(screen.getByLabelText(/The number, in words/i)).not.toHaveAttribute('readonly');
  });
});
