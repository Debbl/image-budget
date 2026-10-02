import { runPipeline } from './core/pipeline.ts'
import { decode } from './decode/index.ts'
import { canvasEngine } from './engines/canvas.ts'
import type { Options, Result } from './types.ts'

export type {
  Attempt,
  Decoder,
  Degradation,
  Engine,
  Format,
  Options,
  Plan,
  Result,
} from './types.ts'
export { canvasEngine } from './engines/canvas.ts'
export { decode, decodeHeic, decodeNative, isHeic } from './decode/index.ts'

/**
 * Compress `input` to fit a byte budget, and report what actually happened.
 *
 * Everything in this problem space fails silently - an unsupported format
 * comes back as PNG, EXIF vanishes with the canvas, an oversized image
 * renders blank, a HEIC simply will not decode. So the contract is not "this
 * returns a smaller image", it is:
 *
 *   `result.format` is read off the blob, never echoed from the request, and
 *   `result.degraded` is empty only when the output is exactly what was asked
 *   for.
 *
 * HEIC input is detected and decoded through `heic-to`, imported on demand.
 * AVIF needs the jSquash engine - browsers decode AVIF far more widely than
 * they encode it:
 *
 * ```ts
 * import { compress } from 'image-budget'
 * import { jsquashEngine } from 'image-budget/jsquash'
 *
 * const result = await compress(file, {
 *   maxBytes: 200 * 1024,
 *   format: 'image/avif',
 *   engine: jsquashEngine,
 * })
 * if (result.degraded.length) console.warn(result.degraded)
 * ```
 */
export function compress(input: Blob, options: Options = {}): Promise<Result> {
  return runPipeline(input, options, {
    decode,
    engine: options.engine ?? canvasEngine,
  })
}
