import type { Decoder } from '../types.ts'

/**
 * HEIC brands inside an ISO-BMFF `ftyp` box.
 *
 * Sniffed from the bytes rather than read off `file.type`, which iOS
 * frequently leaves empty for camera-roll picks - the one case this check
 * exists for.
 */
const HEIC_BRANDS: ReadonlySet<string> = new Set([
  'heic',
  'heix',
  'heim',
  'heis',
  'hevc',
  'hevm',
  'hevs',
  'mif1',
  'msf1',
])

export async function isHeic(blob: Blob): Promise<boolean> {
  if (blob.size < 12) return false
  const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer())
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...head.slice(from, to))

  return ascii(4, 8) === 'ftyp' && HEIC_BRANDS.has(ascii(8, 12))
}

/**
 * `imageOrientation: 'from-image'` is what keeps EXIF orientation from being
 * lost: it bakes the rotation into the pixels here, so nothing downstream has
 * to carry an orientation flag the canvas would have dropped anyway.
 */
export const decodeNative: Decoder = (blob) =>
  createImageBitmap(blob, { imageOrientation: 'from-image' })

/**
 * Imported on demand so a bundle only pays for libheif when a HEIC actually
 * arrives. `heic-to` can hand back an ImageBitmap directly, which is why the
 * decoder seam trades in bitmaps.
 */
export const decodeHeic: Decoder = async (blob) => {
  const { heicTo } = await import('heic-to')
  return heicTo({
    blob,
    type: 'bitmap',
    options: { imageOrientation: 'from-image' },
  })
}

/** Sniff first, then delegate. The only decode path callers need. */
export const decode: Decoder = async (blob) =>
  (await isHeic(blob)) ? decodeHeic(blob) : decodeNative(blob)
