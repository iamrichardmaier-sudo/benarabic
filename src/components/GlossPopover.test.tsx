import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GlossPopover from './GlossPopover';

function renderGloss() {
  return render(
    <GlossPopover
      title="ك-ت-ب"
      subtitle="Root"
      body="writing"
      triggerLabel="What the root means"
    >
      <span>ك-ت-ب</span>
    </GlossPopover>,
  );
}

describe('GlossPopover', () => {
  it('stays shut until asked', () => {
    renderGloss();
    expect(screen.queryByText('writing')).not.toBeInTheDocument();
  });

  it('opens on hover, for a mouse', async () => {
    const user = userEvent.setup();
    renderGloss();
    await user.hover(screen.getByRole('button', { name: 'What the root means' }));
    expect(await screen.findByText('writing')).toBeInTheDocument();
  });

  // Driven with fireEvent rather than userEvent: jsdom gives every element zero
  // size, so simulated pointer movement lands on the open bubble and re-opens
  // it. Dispatching the leave directly tests the handler this component owns.
  it('closes again when the pointer leaves', async () => {
    const user = userEvent.setup();
    renderGloss();
    const trigger = screen.getByRole('button', { name: 'What the root means' });
    await user.hover(trigger);
    expect(await screen.findByText('writing')).toBeInTheDocument();

    // React synthesises onMouseLeave from mouseout, so a bare mouseleave event
    // would never reach the handler.
    fireEvent.mouseOut(trigger, { relatedTarget: document.body });
    expect(screen.queryByText('writing')).not.toBeInTheDocument();
  });

  it('opens on tap, since a phone has no hover', async () => {
    const user = userEvent.setup();
    renderGloss();
    await user.click(screen.getByRole('button', { name: 'What the root means' }));
    expect(await screen.findByText('writing')).toBeInTheDocument();
  });

  it('opens on keyboard focus', async () => {
    const user = userEvent.setup();
    renderGloss();
    await user.tab();
    expect(await screen.findByText('writing')).toBeInTheDocument();
  });

  it('shows the subtitle alongside the explanation', async () => {
    const user = userEvent.setup();
    renderGloss();
    await user.click(screen.getByRole('button', { name: 'What the root means' }));
    expect(await screen.findByText('Root')).toBeInTheDocument();
  });
});
