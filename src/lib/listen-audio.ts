/**
 * Turns a set of cards into one continuous track: each word's Arabic said
 * the chosen number of times, a gap, then its English the chosen number of
 * times, a gap, then on to the next card -- generated once per card and
 * repeated in the audio itself, not by asking the speech service for the
 * same line twice. The result is a normal MP3, so it plays through a lock
 * screen exactly like the podcasts do, and looping it is just `audio.loop`.
 */
import { supabase } from '@/integrations/supabase/client';
import { concatSamples, silence, encodeMp3 } from '@/lib/mp3';

export interface ListenCard {
  arabic: string;
  english: string;
}

export interface ListenOptions {
  arabicRepeats: number;
  englishRepeats: number;
  gapSeconds: number;
}

async function fetchClip(text: string, voice: 'ar' | 'en'): Promise<{ samples: Float32Array; sampleRate: number }> {
  const { data, error } = await supabase.functions.invoke('generate-speech', {
    body: { text, voice },
  });
  if (error) throw error;
  if (!(data instanceof Blob)) throw new Error('The speech service returned something unexpected.');

  const buffer = await data.arrayBuffer();
  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  try {
    const decoded = await ctx.decodeAudioData(buffer.slice(0));
    return { samples: decoded.getChannelData(0), sampleRate: decoded.sampleRate };
  } finally {
    ctx.close();
  }
}

/**
 * Build the track for one pass through the set. `onProgress` fires once per
 * card fetched, since the fetches -- not the assembly after them -- are what
 * takes the time.
 */
export async function buildListenTrack(
  cards: ListenCard[],
  options: ListenOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  if (cards.length === 0) throw new Error('That set has no cards.');

  const parts: Float32Array[] = [];
  let rate = 44100;
  const gap = () => silence(options.gapSeconds, rate);

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const [ar, en] = await Promise.all([
      fetchClip(card.arabic, 'ar'),
      fetchClip(card.english, 'en'),
    ]);
    rate = ar.sampleRate;

    for (let r = 0; r < options.arabicRepeats; r++) {
      if (r > 0) parts.push(gap());
      parts.push(ar.samples);
    }
    parts.push(gap());
    for (let r = 0; r < options.englishRepeats; r++) {
      if (r > 0) parts.push(gap());
      parts.push(en.samples);
    }
    if (i < cards.length - 1) parts.push(gap());

    onProgress?.(i + 1, cards.length);
  }

  return encodeMp3(concatSamples(parts), rate);
}
