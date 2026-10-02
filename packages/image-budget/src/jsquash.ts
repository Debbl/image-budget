import { fit } from './core/geometry.ts'
import { memoize } from './core/verify.ts'
import type { Engine, Format, Plan } from './types.ts'

/**
 * The WASM codecs, behind their own entry point so the default bundle never
 * pulls in libavif. Each import is dynamic and each package is an optional
 * peer: a project that only wants WebP installs nothing extra.
 */
const ENCODERS: Partial<
  Record<
    Format,
    () => Promise<(data: ImageData, opts: object) => Promise<ArrayBuffer>>
  >
> = {
  'image/avif': async () => (await import('@jsquash/avif')).encode,
  'image/webp': async () => (await import('@jsquash/webp')).encode,
  'image/jpeg': async () => (await import('@jsquash/jpeg')).encode,
}

/**
 * Unlike the canvas engine there is nothing to detect in the browser: a codec
 * either shipped in the bundle or it did not. So the probe asks the module
 * graph, not the platform - an unresolved optional peer is the only way a
 * format goes missing here.
 */
const probe = memoize(async (): Promise<ReadonlySet<Format>> => {
  const available = new Set<Format>()

  await Promise.all(
    Object.entries(ENCODERS).map(async ([format, load]) => {
      try {
        await load()
        available.add(format as Format)
      } catch {
        // Optional peer not installed, or no WASM in this environment.
      }
    }),
  )

  return available
})

function toImageData(source: ImageBitmap, plan: Plan) {
  const [width, height] = fit(
    source.width,
    source.height,
    plan.maxDimension,
    plan.maxPixels,
  )

  // jSquash trades in raw pixels, so the resize still happens on a canvas -
  // the codecs encode, they do not scale.
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('image-budget: no 2d context')

  context.drawImage(source, 0, 0, width, height)
  return { data: context.getImageData(0, 0, width, height), width, height }
}

export const jsquashEngine: Engine = {
  id: 'jsquash',
  preservesExif: false,
  // The codecs run off-canvas, but the resize above still goes through one.
  safeMaxPixels: 16_777_216,
  probe,
  attempt: async (source, plan) => {
    const load = ENCODERS[plan.format]
    if (!load) {
      throw new Error(`image-budget: jsquash cannot encode ${plan.format}`)
    }

    const encode = await load()
    const { data, width, height } = toImageData(source, plan)
    const buffer = await encode(data, {
      quality: Math.round(plan.quality * 100),
    })

    // The type is ours to assert here, which is why the silent-PNG fallback
    // cannot happen on this path: the codec produces the format or it throws.
    return { blob: new Blob([buffer], { type: plan.format }), width, height }
  },
}
