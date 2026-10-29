import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import Illustration from './Illustration';
import ReviewComplete from './ReviewComplete';
import LibraryHome from './LibraryHome';

describe('Illustration', () => {
  it('is decorative, sized to avoid layout shift, and lazy unless asked', () => {
    const { container } = render(<Illustration name="bible" />);
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', '/illustrations/bible.webp');
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('aria-hidden', 'true');
    expect(img).toHaveAttribute('width', '480');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('disappears rather than showing a broken image when it cannot load', () => {
    const { container } = render(<Illustration name="courtyard" eager />);
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('loading', 'eager');
    fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('where the illustrations appear', () => {
  it('ends a review with the evening still life', () => {
    const { container } = render(<ReviewComplete reviewed={12} />);
    expect(container.querySelector('[data-illustration="review-done"]')).not.toBeNull();
  });

  it('gives each Library shelf its picture', () => {
    const { container } = render(<LibraryHome onSelect={() => {}} />);
    expect(container.querySelector('[data-illustration="bible"]')).not.toBeNull();
    expect(container.querySelector('[data-illustration="articles"]')).not.toBeNull();
  });
});
