import { fit } from '../core/geometry.ts'
import { ALL_FORMATS, didProduce, memoize } from '../core/verify.ts'
import type { Engine, Format, Plan } from '../types.ts'

/**
 * Safari returns a *blank* canvas past roughly this many pixels instead of
 * throwing, so it is a correctness ceiling rather than a performance one.
 */
const SAFE_MAX_PIXELS = 16_777_216

function draw(source: ImageBitmap, plan: Plan) {
  const [width, height] = fit(
    source.width,
    source.height,
    plan.maxDimension,
    plan.maxPixels ?? SAFE_MAX_PIXELS,
  )

  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('image-budget: no 2d context')

  context.drawImage(source, 0, 0, width, height)
  return { canvas, width, height }
}

/**
 * Probe by encoding an 8x8 canvas to each format and reading the type back.
 * `convertToBlob` does not reject an unsupported type - it returns PNG - so
 * asking is the only way to find out.
 */
const probe = memoize(async (): Promise<ReadonlySet<Format>> => {
  const supported = new Set<Format>()
  if (typeof OffscreenCanvas === 'undefined') return supported

  const canvas = new OffscreenCanvas(8, 8)
  canvas.getContext('2d')?.fillRect(0, 0, 8, 8)

  for (const format of ALL_FORMATS) {
    try {
      const blob = await canvas.convertToBlob({ type: format, quality: 0.8 })
      if (didProduce(blob, format)) supported.add(format)
    } catch {
      // A throwing codec is an unsupported codec.
    }
  }

  return supported
})

export const canvasEngine: Engine = {
  id: 'canvas',
  // Canvas holds pixels, not metadata. Anything in EXIF is gone by the time
  // the bitmap is drawn - orientation included, which is why decoding applies
  // it up front.
  preservesExif: false,
  safeMaxPixels: SAFE_MAX_PIXELS,
  probe,
  attempt: async (source, plan) => {
    const { canvas, width, height } = draw(source, plan)
    const blob = await canvas.convertToBlob({
      type: plan.format,
      quality: plan.quality,
    })
    return { blob, width, height }
  },
}
