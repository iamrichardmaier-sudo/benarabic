/**
 * Turning the model's raw samples into a file worth keeping.
 *
 * The obvious output is a WAV, which needs no encoder — but an hour of speech
 * is about 170MB as WAV and 15MB as MP3, and this file is meant to live on a
 * phone. So it is encoded, and the encoder is loaded only when it is needed.
 */

/** Samples per MP3 frame; lame wants the input in blocks of this size. */
const BLOCK = 1152;
const KBPS = 64;

/** Float samples in -1..1 as the 16-bit integers the encoder expects. */
export function toPcm16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    // Clamped first: a sample past 1.0 wraps to a loud click otherwise.
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/** Everything spoken so far, end to end, as one run of samples. */
export function concatSamples(parts: Float32Array[]): Float32Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Float32Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** A gap of silence, so the joins between chunks are not breathless. */
export function silence(seconds: number, sampleRate: number): Float32Array {
  return new Float32Array(Math.max(0, Math.round(seconds * sampleRate)));
}

/**
 * Encode mono samples to an MP3 blob.
 *
 * The encoder is imported here rather than at the top of the file so that
 * opening the app does not pay for it — this is a one-off utility tucked away
 * in Settings, and most sessions never touch it.
 */
export async function encodeMp3(
  samples: Float32Array,
  sampleRate: number,
  onProgress?: (fraction: number) => void,
): Promise<Blob> {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const encoder = new Mp3Encoder(1, sampleRate, KBPS);
  const pcm = toPcm16(samples);
  const chunks: Uint8Array[] = [];

  for (let i = 0; i < pcm.length; i += BLOCK) {
    const block = pcm.subarray(i, i + BLOCK);
    const encoded = encoder.encodeBuffer(block);
    if (encoded.length > 0) chunks.push(new Uint8Array(encoded));
    // Reported every few seconds of audio rather than every frame, which
    // would be thousands of renders for a long document.
    if (onProgress && i % (BLOCK * 200) === 0) onProgress(i / pcm.length);
  }

  const last = encoder.flush();
  if (last.length > 0) chunks.push(new Uint8Array(last));
  onProgress?.(1);

  return new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
}

/** A filename that says where the audio came from. */
export function audioFileName(source: string): string {
  const base = source.replace(/\.pdf$/i, '').replace(/[^\w\s-]/g, '').trim() || 'reading';
  return `${base.replace(/\s+/g, '-').slice(0, 60)}.mp3`;
}
