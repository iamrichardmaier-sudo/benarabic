/**
 * Speech generated on the device, with no service behind it.
 *
 * Kokoro is a small neural voice model that runs in the browser. It is used
 * here rather than the browser's own speechSynthesis for two reasons that
 * matter more than they sound: speechSynthesis cannot be recorded, so there
 * is no file at the end of it, and it stops the moment a phone is locked or
 * the app is left. A generated file has neither problem — it plays like any
 * other track, screen off, with lock-screen controls.
 *
 * The price is a model to download once, and generation that is slower than
 * listening. Both are paid in time rather than money.
 */

/** The model, quantised: a quarter the size, with no audible cost here. */
const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const DTYPE = 'q8';

export interface Voice {
  id: string;
  label: string;
}

/** A short list rather than all of them — this is a reading voice, not a toy. */
export const VOICES: Voice[] = [
  { id: 'af_heart', label: 'Heart — American, warm' },
  { id: 'af_bella', label: 'Bella — American, bright' },
  { id: 'am_michael', label: 'Michael — American, low' },
  { id: 'bf_emma', label: 'Emma — British' },
  { id: 'bm_george', label: 'George — British, low' },
];

export const DEFAULT_VOICE = 'af_heart';

interface KokoroAudio {
  audio: Float32Array;
  sampling_rate: number;
}

interface KokoroModel {
  generate: (text: string, options: { voice: string }) => Promise<KokoroAudio>;
}

let modelPromise: Promise<KokoroModel> | null = null;

/**
 * Load the voice model, once per session.
 *
 * The first call downloads a few hundred megabytes and the browser caches it,
 * so the wait lands on the first document and not the ones after it.
 */
export async function loadVoiceModel(
  onProgress?: (fraction: number) => void,
): Promise<KokoroModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const { KokoroTTS } = await import('kokoro-js');
      return (await KokoroTTS.from_pretrained(MODEL, {
        dtype: DTYPE,
        device: 'wasm',
        progress_callback: (p: { status?: string; progress?: number }) => {
          if (typeof p.progress === 'number') onProgress?.(p.progress / 100);
        },
      } as never)) as unknown as KokoroModel;
    })().catch((err) => {
      // Cleared so a failed download can be retried rather than the failure
      // being cached for the rest of the session.
      modelPromise = null;
      throw err;
    });
  }
  return modelPromise;
}

export interface SpokenChunk {
  samples: Float32Array;
  sampleRate: number;
}

/** Voice one piece of text. */
export async function speak(text: string, voice: string): Promise<SpokenChunk> {
  const model = await loadVoiceModel();
  const audio = await model.generate(text, { voice });
  return { samples: audio.audio, sampleRate: audio.sampling_rate };
}

/** Whether this browser can run the model at all. */
export function canGenerateSpeech(): boolean {
  return typeof WebAssembly === 'object' && typeof document !== 'undefined';
}
