import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import WaznIcon from './WaznIcon';
import { WAZN_ICON_NAMES } from '@/lib/wazn-icons';
import { DECK_ICON_KEYS } from '@/lib/deck-icons';

describe('the deck marks', () => {
  it('names every icon once', () => {
    expect(new Set(WAZN_ICON_NAMES).size).toBe(WAZN_ICON_NAMES.length);
  });

  it('draws exactly the marks a deck can choose, no more and no less', () => {
    // A deck key with no drawing renders as an empty tile rather than failing,
    // so that half is checked here where it is loud. The other half catches a
    // mark left behind after the surfaces using it were reverted.
    expect([...WAZN_ICON_NAMES].sort()).toEqual([...DECK_ICON_KEYS].sort());
  });

  it.each(WAZN_ICON_NAMES)('draws %s with geometry inside it', (name) => {
    const { container } = render(<WaznIcon name={name} />);
    const svg = container.querySelector('svg')!;
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('viewBox')).toBe('0 0 48 48');
    // An icon that renders an empty <svg> looks identical to a missing one.
    expect(svg.children.length).toBeGreaterThan(0);
  });

  it('never hardcodes a colour, so one drawing serves light and dark', () => {
    for (const name of WAZN_ICON_NAMES) {
      const { container } = render(<WaznIcon name={name} />);
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('stroke')).toBe('currentColor');
      expect(svg.innerHTML).not.toMatch(/(fill|stroke)="#|rgb\(/);
    }
  });

  it('weights the stroke up when the icon is drawn small', () => {
    // Ornament at nav-bar size fades away without it.
    const small = render(<WaznIcon name="compass" size={20} />).container.querySelector('svg')!;
    const large = render(<WaznIcon name="compass" size={44} />).container.querySelector('svg')!;
    expect(Number(small.getAttribute('stroke-width')))
      .toBeGreaterThan(Number(large.getAttribute('stroke-width')));
  });
});
