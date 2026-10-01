import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InfoHint from './InfoHint';

describe('InfoHint', () => {
  it('stays shut until tapped', () => {
    render(<InfoHint label="What is Fusha?">Fusha is Modern Standard Arabic.</InfoHint>);
    expect(screen.queryByText(/Modern Standard Arabic/)).not.toBeInTheDocument();
  });

  it('opens its explanation on tap', async () => {
    const user = userEvent.setup();
    render(<InfoHint label="What is Fusha?">Fusha is Modern Standard Arabic.</InfoHint>);
    await user.click(screen.getByRole('button', { name: 'What is Fusha?' }));
    expect(await screen.findByText(/Modern Standard Arabic/)).toBeInTheDocument();
  });

  it('tapping it never bubbles to whatever sits underneath', async () => {
    const user = userEvent.setup();
    let bubbled = false;
    render(
      <div onClick={() => { bubbled = true; }}>
        <InfoHint label="What is Fusha?">Fusha is Modern Standard Arabic.</InfoHint>
      </div>,
    );
    await user.click(screen.getByRole('button', { name: 'What is Fusha?' }));
    expect(bubbled).toBe(false);
  });
});
