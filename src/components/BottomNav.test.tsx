import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BottomNav from './BottomNav';

describe('BottomNav', () => {
  it('shows all four destinations', () => {
    render(<BottomNav active="wordMastery" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Word Mastery/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Grammar/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Memorization/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bible/ })).toBeInTheDocument();
  });

  it('marks only the active tab as current', () => {
    render(<BottomNav active="grammar" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Grammar/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /Word Mastery/ })).not.toHaveAttribute('aria-current');
  });

  it('reports which tab was tapped', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<BottomNav active="wordMastery" onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: /Memorization/ }));
    expect(onSelect).toHaveBeenCalledWith('memorization');
  });
});
