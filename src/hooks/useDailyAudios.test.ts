import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const calls: { order?: unknown[]; limit?: number } = {};

/** A Supabase query builder stub: every chained call returns itself, and
 * the object is thenable so `await` resolves regardless of chain length. */
function queryStub(result: { data: unknown; error: unknown }) {
  const builder = {
    select: () => builder,
    order: (...args: unknown[]) => {
      calls.order = args;
      return builder;
    },
    limit: (n: number) => {
      calls.limit = n;
      return builder;
    },
    then: (resolve: (v: typeof result) => void) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

const fromMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

const { useDailyAudios } = await import('./useDailyAudios');

beforeEach(() => {
  fromMock.mockReset();
  calls.order = undefined;
  calls.limit = undefined;
});

describe('useDailyAudios', () => {
  it('asks for the latest 14 episodes, newest first, and maps the rows', async () => {
    fromMock.mockReturnValue(
      queryStub({
        data: [
          {
            id: 'a', audio_date: '2026-10-08', title: 'Oct 8 — At the Clothing Shop',
            audio_url: 'https://x/daily-audio/2026-10-08.mp3',
            image_url: 'https://x/daily-audio-art/2026-10-08.png', duration_secs: 754,
          },
        ],
        error: null,
      }),
    );

    const { result } = renderHook(() => useDailyAudios());
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fromMock).toHaveBeenCalledWith('daily_audios');
    expect(calls.order).toEqual(['audio_date', { ascending: false }]);
    expect(calls.limit).toBe(14);
    expect(result.current.episodes).toEqual([
      {
        id: 'a', audioDate: '2026-10-08', title: 'Oct 8 — At the Clothing Shop',
        audioUrl: 'https://x/daily-audio/2026-10-08.mp3',
        imageUrl: 'https://x/daily-audio-art/2026-10-08.png', durationSecs: 754,
      },
    ]);
    expect(result.current.error).toBeNull();
  });

  it('returns an empty list, not an error, when nothing has been published yet', async () => {
    fromMock.mockReturnValue(queryStub({ data: [], error: null }));
    const { result } = renderHook(() => useDailyAudios());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.episodes).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('surfaces the message when the query fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fromMock.mockReturnValue(queryStub({ data: null, error: { message: 'boom' } }));
    const { result } = renderHook(() => useDailyAudios());
    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.loading).toBe(false);
    expect(result.current.episodes).toEqual([]);
  });
});
