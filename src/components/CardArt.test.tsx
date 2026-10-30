import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/bible-root-index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bible-root-index')>();
  return { ...actual, fetchWordsByRoot: vi.fn(async () => []) };
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CardArt from './CardArt';
import Flashcard from './Flashcard';
import { createCard, type FlashCard } from '@/lib/spaced-repetition';

const card = (over: Partial<FlashCard> = {}): FlashCard => ({ ...createCard('قَهْوة', 'coffee'), ...over });

beforeEach(() => {
  vi.stubGlobal('speechSynthesis', { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [] });
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
});

describe('the card art slot', () => {
  it('draws nothing for now', () => {
    const { container } = render(<CardArt card={card()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('leaves the card readable without it: meaning on the prompt, and on the answer', async () => {
    render(<Flashcard card={card()} direction="ar-to-en" onRate={() => {}} />);
    expect(screen.queryByText('coffee')).toBeNull();
    await userEvent.click(screen.getByText('Tap to flip'));
    expect(screen.getByText('coffee')).toBeInTheDocument();
  });

  it('still shows a card photo when there is one', () => {
    const { container } = render(
      <Flashcard card={card({ imageUrl: 'https://x/coffee.jpg' })} direction="en-to-ar" onRate={() => {}} />,
    );
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://x/coffee.jpg');
  });
});
