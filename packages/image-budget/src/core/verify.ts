import type { Format } from '../types.ts'

/**
 * The one primitive behind both format probing and post-encode verification -
 * they are the same question asked at two different times.
 *
 * `canvas.toBlob` and `OffscreenCanvas.convertToBlob` do not reject an
 * unsupported type; they quietly hand back PNG. The only way to know what you
 * got is to read it back off the blob.
 */
export function didProduce(blob: Blob, want: string): boolean {
  return blob.type === want
}

/** Caches the probe: browser codec support does not change mid-session. */
export function memoize<T>(run: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | undefined
  return () => (cached ??= run())
}

export const ALL_FORMATS: readonly Format[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]
