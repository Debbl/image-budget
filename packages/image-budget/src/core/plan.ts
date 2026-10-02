import type { Format } from '../types.ts'

/** Formats that can carry an alpha channel. */
const ALPHA_CAPABLE: ReadonlySet<string> = new Set([
  'image/png',
  'image/webp',
  'image/avif',
])

/**
 * JPEG is the only common input that provably has no alpha. Everything else
 * might, and we cannot find out cheaply - reading pixels back costs a decode
 * plus a full scan, on the main thread, for a question we can answer
 * conservatively for free.
 */
export function mayHaveAlpha(inputType: string): boolean {
  return inputType !== 'image/jpeg'
}

/**
 * Pick the output format.
 *
 * `'auto'` will not flatten an image that might be transparent: turning a
 * logo-on-transparent PNG into JPEG paints the background black, and like the
 * rest of this problem space it does so without any error. Ratio is worth
 * less than not corrupting the image.
 */
export function pickFormat(
  want: Format | 'auto' | undefined,
  inputType: string,
  supported: ReadonlySet<Format>,
): Format {
  if (want && want !== 'auto') {
    if (supported.has(want)) return want
    // Requested format is unavailable here. Fall through to auto, and let the
    // caller compare against `want` to report the degradation.
  }

  const candidates: readonly Format[] = mayHaveAlpha(inputType)
    ? ['image/webp', 'image/png']
    : ['image/webp', 'image/jpeg']

  for (const candidate of candidates) {
    if (supported.has(candidate)) return candidate
  }

  // Nothing preferred is available. Keep the input format if we can emit it,
  // otherwise PNG - lossless and universally supported, so the worst outcome
  // is a big file rather than a broken one.
  if (isFormat(inputType) && supported.has(inputType)) return inputType
  return 'image/png'
}

function isFormat(type: string): type is Format {
  return (
    type === 'image/jpeg' ||
    type === 'image/png' ||
    type === 'image/webp' ||
    type === 'image/avif'
  )
}

/** PNG ignores quality, so searching it wastes attempts. */
export function isLossless(format: Format): boolean {
  return format === 'image/png'
}

export { ALPHA_CAPABLE }
