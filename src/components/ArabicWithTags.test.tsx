import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ArabicWithTags from './ArabicWithTags';
import type { BibleWordTag } from '@/hooks/useBibleWordTags';

describe('ArabicWithTags', () => {
  it('makes a tagged word tappable', () => {
    const tags = new Map<string, BibleWordTag>([
      ['كتب', { surface: 'كتب', lemma: 'كَتَبَ', gloss: 'to write', root: 'ك-ت-ب' } as BibleWordTag],
    ]);
    render(<ArabicWithTags text="كتب" tags={tags} />);
    expect(screen.getByRole('button', { name: /كتب/ })).toBeInTheDocument();
  });

  it('still makes an untagged word tappable, rather than leaving it inert', () => {
    // This used to render as a bare <span> with no interaction at all — a
    // tap did nothing, which reads as the app being broken rather than as
    // "this word has no data yet".
    render(<ArabicWithTags text="فيل" tags={new Map()} />);
    expect(screen.getByRole('button', { name: 'فيل' })).toBeInTheDocument();
  });

  it('leaves whitespace and punctuation as plain text', () => {
    const { container } = render(<ArabicWithTags text="فيل كبير." tags={new Map()} />);
    // Two words means two buttons; the space and the period are not buttons.
    expect(container.querySelectorAll('button')).toHaveLength(2);
  });
});
