import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BottomNav from './BottomNav';

describe('BottomNav', () => {
  it('shows all five destinations', () => {
    render(<BottomNav active="home" onSelect={vi.fn()} />);
    for (const label of ['Home', 'Learn', 'Library', 'Review', 'Settings']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it('marks only the active tab as current', () => {
    render(<BottomNav active="learn" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Learn/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /Home/ })).not.toHaveAttribute('aria-current');
  });

  it('reports which tab was tapped', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<BottomNav active="home" onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: /Library/ }));
    expect(onSelect).toHaveBeenCalledWith('library');
  });

  it('reports the tab even when it is already active, so it can act as "back to root"', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<BottomNav active="library" onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: /Library/ }));
    expect(onSelect).toHaveBeenCalledWith('library');
  });

  it('badges Review with the due count, and announces it', () => {
    render(<BottomNav active="home" onSelect={vi.fn()} dueCount={7} />);
    const review = screen.getByRole('button', { name: /Review, 7 due/ });
    expect(review).toBeInTheDocument();
    expect(review).toHaveTextContent('7');
  });

  it('caps a very large due count rather than overflowing the badge', () => {
    render(<BottomNav active="home" onSelect={vi.fn()} dueCount={250} />);
    expect(screen.getByRole('button', { name: /Review/ })).toHaveTextContent('99+');
  });

  it('shows no badge when nothing is due', () => {
    render(<BottomNav active="home" onSelect={vi.fn()} dueCount={0} />);
    expect(screen.getByRole('button', { name: /Review/ })).not.toHaveTextContent('0');
  });
});
