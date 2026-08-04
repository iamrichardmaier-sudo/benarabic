import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupFilter from './GroupFilter';

const counts = { 'Chapter 12': 22, 'Chapter 13': 8 };

function renderFilter(active: string | null, onChange = vi.fn()) {
  render(
    <GroupFilter
      groups={['Chapter 12', 'Chapter 13']}
      active={active}
      onChange={onChange}
      counts={counts}
      totalCount={472}
    />,
  );
  return onChange;
}

describe('GroupFilter', () => {
  it('stays out of the way when there are no groups yet', () => {
    const { container } = render(
      <GroupFilter groups={[]} active={null} onChange={vi.fn()} counts={{}} totalCount={10} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('offers every group plus the whole deck', () => {
    renderFilter(null);
    expect(screen.getByRole('button', { name: /All words/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chapter 12/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chapter 13/ })).toBeInTheDocument();
  });

  it('shows how many cards each choice covers', () => {
    renderFilter(null);
    expect(screen.getByRole('button', { name: /All words 472/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chapter 12 22/ })).toBeInTheDocument();
  });

  it('marks the whole deck as active by default', () => {
    renderFilter(null);
    expect(screen.getByRole('button', { name: /All words/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Chapter 12/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks the chosen group as active instead', () => {
    renderFilter('Chapter 12');
    expect(screen.getByRole('button', { name: /Chapter 12/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /All words/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('narrows to a group when one is tapped', async () => {
    const user = userEvent.setup();
    const onChange = renderFilter(null);
    await user.click(screen.getByRole('button', { name: /Chapter 12/ }));
    expect(onChange).toHaveBeenCalledWith('Chapter 12');
  });

  it('widens back to the whole deck in one tap', async () => {
    const user = userEvent.setup();
    const onChange = renderFilter('Chapter 12');
    await user.click(screen.getByRole('button', { name: /All words/ }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
