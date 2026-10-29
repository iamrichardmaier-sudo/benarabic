import { useCallback, useState } from 'react';
import { readCardMix, writeCardMix, type CardMix } from '@/lib/learn-filter';

/** Vocab, sentences or both, for Learn and Review — remembered between visits. */
export function useCardMix(): [CardMix, (mix: CardMix) => void] {
  const [mix, setMix] = useState<CardMix>(readCardMix);
  const set = useCallback((next: CardMix) => {
    writeCardMix(next);
    setMix(next);
  }, []);
  return [mix, set];
}
