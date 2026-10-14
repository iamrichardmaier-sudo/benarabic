import { useCallback, useState } from 'react';
import { readSentencesOnly, writeSentencesOnly } from '@/lib/learn-filter';

/** The "sentences only" choice for Learn, remembered between visits. */
export function useSentencesOnly(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState<boolean>(readSentencesOnly);
  const set = useCallback((next: boolean) => {
    writeSentencesOnly(next);
    setOn(next);
  }, []);
  return [on, set];
}
