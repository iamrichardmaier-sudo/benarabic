import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/bible-root-index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bible-root-index')>();
  return { ...actual, fetchWordsByRoot: vi.fn(async () => []) };
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CardScene from './CardScene';
import Flashcard from './Flashcard';
import { createCard, type FlashCard } from '@/lib/spaced-repetition';

const card = (over: Partial<FlashCard> = {}): FlashCard => ({ ...createCard('قَهْوة', 'coffee'), ...over });
const sceneOn = (c: HTMLElement) => c.querySelector('[data-scene]');

beforeEach(() => {
  // Flipping a card speaks the Arabic; jsdom has no speech.
  vi.stubGlobal('speechSynthesis', { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [] });
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
});

describe('CardScene', () => {
  it('draws the scene for the meaning, hidden from screen readers', () => {
    const { container } = render(<CardScene card={{ english: 'coffee' }} />);
    const tile = sceneOn(container)!;
    expect(tile).toHaveAttribute('data-scene', 'coffee');
    expect(tile).toHaveAttribute('aria-hidden', 'true');
    expect(tile.className).toContain('scene-tone-warm');
    expect(tile.querySelector('.scene-motion-float')).not.toBeNull();
    // Coffee steams: five particles rising.
    expect(tile.querySelectorAll('.scene-steam')).toHaveLength(5);
  });

  it('prefers the scene stored on the card', () => {
    const { container } = render(<CardScene card={{ english: 'coffee', scene: 'tea' }} />);
    expect(sceneOn(container)).toHaveAttribute('data-scene', 'tea');
  });
});

describe('scenes on the flashcard', () => {
  it('shows the scene with the English prompt', () => {
    const { container } = render(<Flashcard card={card()} direction="en-to-ar" onRate={() => {}} />);
    expect(sceneOn(container)).toHaveAttribute('data-scene', 'coffee');
  });

  it('keeps it off the Arabic prompt, where it would give the answer away, and shows it on the answer', async () => {
    const { container } = render(<Flashcard card={card()} direction="ar-to-en" onRate={() => {}} />);
    expect(sceneOn(container)).toBeNull();
    await userEvent.click(screen.getByText('Tap to flip'));
    expect(sceneOn(container)).toHaveAttribute('data-scene', 'coffee');
  });

  it('shows a card photo instead of the scene when there is one', () => {
    const { container } = render(
      <Flashcard card={card({ imageUrl: 'https://x/coffee.jpg' })} direction="en-to-ar" onRate={() => {}} />,
    );
    expect(sceneOn(container)).toBeNull();
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://x/coffee.jpg');
  });
});
