import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BackButton from './BackButton';

describe('BackButton', () => {
  it('names its destination so the user never has to guess where it lands', () => {
    render(<BackButton onClick={vi.fn()} label="Library" />);
    const btn = screen.getByRole('button', { name: 'Back to Library' });
    expect(btn).toHaveTextContent('Library');
  });

  it('falls back to a plain "Back" when no destination is given', () => {
    render(<BackButton onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Back to Back' })).toHaveTextContent('Back');
  });

  it('calls the handler when tapped', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<BackButton onClick={onClick} label="Home" />);
    await user.click(screen.getByRole('button', { name: 'Back to Home' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
