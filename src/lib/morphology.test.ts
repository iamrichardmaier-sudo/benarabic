import { describe, it, expect, beforeEach, vi } from 'vitest';

const selectMock = vi.fn();
const onlineMock = vi.fn(() => true);

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ select: selectMock }) },
}));

vi.mock('@/hooks/useOnlineStatus', () => ({
  isOnline: () => onlineMock(),
  useOnlineStatus: () => onlineMock(),
}));

const { loadRootMeanings, VERB_FORM_GLOSSES } = await import('./morphology');

beforeEach(() => {
  localStorage.clear();
  selectMock.mockReset();
  onlineMock.mockReturnValue(true);
});

describe('loadRootMeanings', () => {
  it('returns glosses keyed by root', async () => {
    selectMock.mockResolvedValue({ data: [{ root: 'ك-ت-ب', meaning: 'writing' }], error: null });
    await expect(loadRootMeanings()).resolves.toEqual({ 'ك-ت-ب': 'writing' });
  });

  it('serves the cache when offline instead of attempting a request', async () => {
    selectMock.mockResolvedValue({ data: [{ root: 'ك-ت-ب', meaning: 'writing' }], error: null });
    await loadRootMeanings(); // warm the cache while online

    onlineMock.mockReturnValue(false);
    selectMock.mockReset();

    await expect(loadRootMeanings()).resolves.toEqual({ 'ك-ت-ب': 'writing' });
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('falls back to the cache when the request fails', async () => {
    selectMock.mockResolvedValue({ data: [{ root: 'د-ر-س', meaning: 'studying' }], error: null });
    await loadRootMeanings();

    selectMock.mockResolvedValue({ data: null, error: { message: 'network down' } });
    await expect(loadRootMeanings()).resolves.toEqual({ 'د-ر-س': 'studying' });
  });

  it('returns nothing rather than throwing on a cold offline start', async () => {
    onlineMock.mockReturnValue(false);
    await expect(loadRootMeanings()).resolves.toEqual({});
  });
});

describe('VERB_FORM_GLOSSES', () => {
  it('covers Forms I through X', () => {
    expect(Object.keys(VERB_FORM_GLOSSES)).toEqual([
      'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
    ]);
  });

  it('gives every form a pattern, a summary and an explanation', () => {
    for (const [form, gloss] of Object.entries(VERB_FORM_GLOSSES)) {
      expect(gloss.pattern, form).toBeTruthy();
      expect(gloss.summary, form).toBeTruthy();
      expect(gloss.detail.length, form).toBeGreaterThan(30);
    }
  });
});
