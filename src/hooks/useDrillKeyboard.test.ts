import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useDrillKeyboard } from './useDrillKeyboard';

function setup(overrides: Partial<Parameters<typeof useDrillKeyboard>[0]> = {}) {
  const onSubmit = vi.fn();
  const onOverride = vi.fn();
  const onNext = vi.fn();
  const props = {
    canSubmit: true,
    hasFeedback: false,
    isWrong: false,
    onSubmit,
    onOverride,
    onNext,
    ...overrides,
  };
  renderHook(() => useDrillKeyboard(props));
  return { onSubmit, onOverride, onNext };
}

describe('useDrillKeyboard', () => {
  it('submits on Enter while unanswered and ready', async () => {
    const user = userEvent.setup();
    const { onSubmit, onNext } = setup({ canSubmit: true, hasFeedback: false });
    await user.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });

  it('does nothing on Enter while unanswered and not ready', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup({ canSubmit: false, hasFeedback: false });
    await user.keyboard('{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('advances on Enter once feedback is showing', async () => {
    const user = userEvent.setup();
    const { onSubmit, onNext } = setup({ hasFeedback: true, isWrong: false });
    await user.keyboard('{Enter}');
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('overrides on Space only when feedback is wrong', async () => {
    const user = userEvent.setup();
    const { onOverride } = setup({ hasFeedback: true, isWrong: true });
    await user.keyboard(' ');
    expect(onOverride).toHaveBeenCalledTimes(1);
  });

  it('ignores Space while correct', async () => {
    const user = userEvent.setup();
    const { onOverride } = setup({ hasFeedback: true, isWrong: false });
    await user.keyboard(' ');
    expect(onOverride).not.toHaveBeenCalled();
  });

  it('ignores Space while still unanswered, so typing a literal space is unaffected', async () => {
    const user = userEvent.setup();
    const { onOverride } = setup({ hasFeedback: false, isWrong: false });
    await user.keyboard(' ');
    expect(onOverride).not.toHaveBeenCalled();
  });

  it('always calls the latest callbacks, not the ones from first render', async () => {
    const user = userEvent.setup();
    const onNextA = vi.fn();
    const onNextB = vi.fn();
    const { rerender } = renderHook(
      (props: Parameters<typeof useDrillKeyboard>[0]) => useDrillKeyboard(props),
      {
        initialProps: {
          canSubmit: false,
          hasFeedback: true,
          isWrong: false,
          onSubmit: vi.fn(),
          onOverride: vi.fn(),
          onNext: onNextA,
        },
      },
    );
    rerender({
      canSubmit: false,
      hasFeedback: true,
      isWrong: false,
      onSubmit: vi.fn(),
      onOverride: vi.fn(),
      onNext: onNextB,
    });
    await user.keyboard('{Enter}');
    expect(onNextA).not.toHaveBeenCalled();
    expect(onNextB).toHaveBeenCalledTimes(1);
  });
});
