import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GrammarHome from './GrammarHome';

describe('GrammarHome', () => {
  it('offers both drills', () => {
    render(<GrammarHome onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Drill Conjugations/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Drill Prepositions/ })).toBeInTheDocument();
  });

  it('reports the chosen destination', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<GrammarHome onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: /Drill Prepositions/ }));
    expect(onSelect).toHaveBeenCalledWith('prepositionDrill');
  });
});
