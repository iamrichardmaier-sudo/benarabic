import { describe, it, expect } from 'vitest';
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
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  it('orders forms by Roman numeral, not alphabetically', () => {
    render(<ConjugationDrill cards={[verb('a', 'X'), verb('b', 'II'), verb('c', 'I')]} onBack={() => {}} />);
    const labels = screen.getAllByRole('checkbox').map(
      (box) => (box.closest('label') as HTMLElement).textContent,
    );
    expect(labels.map((t) => t?.match(/Form [IVX]+/)?.[0])).toEqual(['Form I', 'Form II', 'Form X']);
  });

  it('starts with everything selected so Start needs one tap', () => {
    render(<ConjugationDrill cards={deck} onBack={() => {}} />);
    screen.getAllByRole('checkbox').forEach((box) => expect(box).toBeChecked());
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
