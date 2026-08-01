import { describe, it, expect, beforeEach, vi } from 'vitest';

// The drill pulls root glosses from Supabase; serve them locally so these
// tests exercise the hover behaviour rather than the network.
vi.mock('@/lib/morphology', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/morphology')>();
  return {
    ...actual,
    loadRootMeanings: vi.fn(async () => ({ 'ك-ت-ب': 'writing' })),
  };
});

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConjugationDrill from './ConjugationDrill';
import { createCard, type FlashCard } from '@/lib/spaced-repetition';

/** A fully-tagged verb, i.e. one the drill can actually use. */
function verb(root: string, form: string, extra: Partial<FlashCard> = {}): FlashCard {
  return {
    ...createCard(`w-${root}-${form}`, 'to do something'),
    root,
    verbForm: form as FlashCard['verbForm'],
    wordType: 'verb',
    pastTense: 'فَعَلَ',
    presentTense: 'يَفعَل',
    masdarForm: 'فِعل',
    ...extra,
  };
}

const deck: FlashCard[] = [
  verb('ك-ت-ب', 'I'),
  verb('د-ر-س', 'I'),
  verb('ج-م-ع', 'V'),
  verb('ع-ر-ف', 'V'),
  verb('ب-د-ل', 'VI'),
];

function row(formLabel: string) {
  return screen.getByText(formLabel).closest('label') as HTMLElement;
}

beforeEach(() => {
  localStorage.clear();
});

/** The per-form checkboxes, excluding the short-vowel option. */
function formCheckboxes() {
  return screen.getAllByRole('checkbox', { name: /^Form / });
}

describe('ConjugationDrill form picker', () => {
  it('opens on the picker, not straight into the drill', () => {
    render(<ConjugationDrill cards={deck} onBack={() => {}} />);
    expect(screen.getByText('Pick the verb forms you want to practise.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Drill' })).toBeInTheDocument();
    expect(screen.queryByText('Check Answer')).not.toBeInTheDocument();
  });

  it('lists each form once with its verb count', () => {
    render(<ConjugationDrill cards={deck} onBack={() => {}} />);
    expect(within(row('Form I')).getByText('2 verbs')).toBeInTheDocument();
    expect(within(row('Form V')).getByText('2 verbs')).toBeInTheDocument();
    expect(within(row('Form VI')).getByText('1 verb')).toBeInTheDocument();
    expect(formCheckboxes()).toHaveLength(3);
  });

  it('orders forms by Roman numeral, not alphabetically', () => {
    render(<ConjugationDrill cards={[verb('a', 'X'), verb('b', 'II'), verb('c', 'I')]} onBack={() => {}} />);
    const labels = formCheckboxes().map(
      (box) => (box.closest('label') as HTMLElement).textContent,
    );
    expect(labels.map((t) => t?.match(/Form [IVX]+/)?.[0])).toEqual(['Form I', 'Form II', 'Form X']);
  });

  it('starts with everything selected so Start needs one tap', () => {
    render(<ConjugationDrill cards={deck} onBack={() => {}} />);
    formCheckboxes().forEach((box) => expect(box).toBeChecked());
    expect(screen.getByText('5 verbs selected')).toBeInTheDocument();
  });

  it('drills only the forms left ticked', async () => {
    const user = userEvent.setup();
    render(<ConjugationDrill cards={deck} onBack={() => {}} />);

    // Keep Form VI only — it has a single verb.
    await user.click(within(row('Form I')).getByRole('checkbox'));
    await user.click(within(row('Form V')).getByRole('checkbox'));
    expect(screen.getByText('1 verb selected')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start Drill' }));

    expect(screen.getByText('1 / 1')).toBeInTheDocument();
    expect(screen.getByText('ب-د-ل')).toBeInTheDocument();
    expect(screen.getByText('Form VI')).toBeInTheDocument();
  });

  it('cannot start with nothing selected', async () => {
    const user = userEvent.setup();
    render(<ConjugationDrill cards={deck} onBack={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByText('0 verbs selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Drill' })).toBeDisabled();
  });

  it('can return from the drill to change forms', async () => {
    const user = userEvent.setup();
    render(<ConjugationDrill cards={deck} onBack={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Start Drill' }));
    expect(screen.getByText('1 / 5')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Forms/ }));
    expect(screen.getByText('Pick the verb forms you want to practise.')).toBeInTheDocument();
  });

  it('counts a root+form pair once even when several cards share it', () => {
    render(
      <ConjugationDrill
        cards={[verb('ك-ت-ب', 'I'), verb('ك-ت-ب', 'I'), verb('د-ر-س', 'I')]}
        onBack={() => {}}
      />,
    );
    expect(within(row('Form I')).getByText('2 verbs')).toBeInTheDocument();
  });

  it('ignores verbs missing a masdar, which cannot be drilled', () => {
    render(
      <ConjugationDrill
        cards={[verb('ك-ت-ب', 'I'), verb('ق-ط-ع', 'VII', { masdarForm: null })]}
        onBack={() => {}}
      />,
    );
    expect(within(row('Form I')).getByText('1 verb')).toBeInTheDocument();
    expect(screen.queryByText('Form VII')).not.toBeInTheDocument();
  });

  it('shows the empty state when no verb is fully tagged', () => {
    render(<ConjugationDrill cards={[createCard('بَحر', 'sea')]} onBack={() => {}} />);
    expect(screen.getByText('No tagged verbs found yet.')).toBeInTheDocument();
  });
});

describe('ConjugationDrill short-vowel option', () => {
  const single = [verb('ف-ع-ل', 'I')]; // past فَعَلَ, present يَفعَل, masdar فِعل

  /** Types the unvowelled skeleton of each answer, then submits. */
  async function answerWithoutVowels(user: ReturnType<typeof userEvent.setup>) {
    const [past, present, masdar] = screen.getAllByRole('textbox');
    await user.type(past, 'فعل');
    await user.type(present, 'يفعل');
    await user.type(masdar, 'فعل');
    await user.click(screen.getByRole('button', { name: 'Check Answer' }));
  }

  it('is off by default, so vowels are still graded', async () => {
    const user = userEvent.setup();
    render(<ConjugationDrill cards={single} onBack={() => {}} />);
    expect(screen.getByRole('checkbox', { name: /Don't check short vowels/ })).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Start Drill' }));
    await answerWithoutVowels(user);

    expect(screen.getByRole('button', { name: /Continue/ })).toBeInTheDocument();
    expect(screen.queryByText(/Correct — Continue/)).not.toBeInTheDocument();
  });

  it('accepts unvowelled answers once enabled', async () => {
    const user = userEvent.setup();
    render(<ConjugationDrill cards={single} onBack={() => {}} />);

    await user.click(screen.getByRole('checkbox', { name: /Don't check short vowels/ }));
    await user.click(screen.getByRole('button', { name: 'Start Drill' }));
    await answerWithoutVowels(user);

    expect(screen.getByRole('button', { name: /Correct — Continue/ })).toBeInTheDocument();
  });

  it('says so during the drill when enabled', async () => {
    const user = userEvent.setup();
    render(<ConjugationDrill cards={single} onBack={() => {}} />);
    await user.click(screen.getByRole('checkbox', { name: /Don't check short vowels/ }));
    await user.click(screen.getByRole('button', { name: 'Start Drill' }));

    expect(screen.getByText("Short vowels aren't being checked.")).toBeInTheDocument();
  });

  it('remembers the choice for next time', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ConjugationDrill cards={single} onBack={() => {}} />);
    await user.click(screen.getByRole('checkbox', { name: /Don't check short vowels/ }));
    unmount();

    render(<ConjugationDrill cards={single} onBack={() => {}} />);
    expect(screen.getByRole('checkbox', { name: /Don't check short vowels/ })).toBeChecked();
  });
});

describe('ConjugationDrill root and form glosses', () => {
  async function startDrill(cards: FlashCard[]) {
    const user = userEvent.setup();
    render(<ConjugationDrill cards={cards} onBack={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Start Drill' }));
    return user;
  }

  it('explains the root on hover', async () => {
    const user = await startDrill([verb('ك-ت-ب', 'I')]);
    await user.hover(screen.getByRole('button', { name: /What the root ك-ت-ب means/ }));
    expect(await screen.findByText('writing')).toBeInTheDocument();
  });

  it('says so plainly when a root has no gloss recorded', async () => {
    const user = await startDrill([verb('ز-ز-ز', 'I')]);
    await user.hover(screen.getByRole('button', { name: /What the root ز-ز-ز means/ }));
    expect(await screen.findByText(/No gloss recorded for this root yet/)).toBeInTheDocument();
  });

  it('explains what the form does to the root', async () => {
    const user = await startDrill([verb('ك-ت-ب', 'II')]);
    await user.hover(screen.getByRole('button', { name: /What Form II does to a root/ }));
    expect(await screen.findByText(/Form II — Causative or intensive/)).toBeInTheDocument();
    expect(await screen.findByText(/Doubling the middle letter/)).toBeInTheDocument();
  });

  it('shows the pattern the root is poured into', async () => {
    const user = await startDrill([verb('ك-ت-ب', 'X')]);
    await user.hover(screen.getByRole('button', { name: /What Form X does to a root/ }));
    expect(await screen.findByText('اِستَفعَلَ')).toBeInTheDocument();
  });

  it('keeps both hints shut until asked', async () => {
    await startDrill([verb('ك-ت-ب', 'I')]);
    expect(screen.queryByText('writing')).not.toBeInTheDocument();
    expect(screen.queryByText(/The base form/)).not.toBeInTheDocument();
  });

  it('opens on tap too, for a phone', async () => {
    const user = await startDrill([verb('ك-ت-ب', 'I')]);
    await user.click(screen.getByRole('button', { name: /What the root ك-ت-ب means/ }));
    expect(await screen.findByText('writing')).toBeInTheDocument();
  });
});
