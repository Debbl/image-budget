import { fit } from './geometry.ts'
import { isLossless, pickFormat } from './plan.ts'
import { SEEK_DEFAULTS, seek } from './seek.ts'
import { didProduce } from './verify.ts'
import type { Decoder, Degradation, Engine, Options, Result } from '../types.ts'

export interface Deps {
  decode: Decoder
  engine: Engine
}

/**
 * The whole pipeline, with both seams handed in.
 *
 * `compress` is a two-argument wrapper over this; tests drive it with a fake
 * decoder and a fake engine, which is how every branch here is reachable
 * without a browser codec.
 */
export async function runPipeline(
  input: Blob,
  options: Options,
  deps: Deps,
): Promise<Result> {
  const { engine } = deps
  const degraded: Degradation[] = []

  const source = await deps.decode(input)

  try {
    const supported = await engine.probe()
    const format = pickFormat(options.format, input.type, supported)

    // Asked for something this engine cannot emit. Known before encoding.
    if (
      options.format &&
      options.format !== 'auto' &&
      format !== options.format
    ) {
      degraded.push({ kind: 'format', want: options.format, got: format })
    }

    if (options.preserveExif && !engine.preservesExif) {
      degraded.push({ kind: 'exif', reason: 'engine-cannot-preserve' })
    }

    const natural = [source.width, source.height] as const
    const capped = fit(
      source.width,
      source.height,
      options.maxDimension,
      engine.safeMaxPixels,
    )

    if (capped[0] !== natural[0] || capped[1] !== natural[1]) {
      degraded.push({
        kind: 'dimension',
        // A cap the caller did not ask for is the engine protecting itself.
        reason: options.maxDimension ? 'budget' : 'engine-pixel-ceiling',
        from: natural,
        to: capped,
      })
    }

    const outcome = await seek(
      (quality, scale) =>
        engine.attempt(source, {
          format,
          quality,
          maxDimension: Math.max(1, Math.round(Math.max(...capped) * scale)),
          maxPixels: engine.safeMaxPixels,
        }),
      {
        ...SEEK_DEFAULTS,
        maxBytes: options.maxBytes,
        maxAttempts: options.maxAttempts ?? SEEK_DEFAULTS.maxAttempts,
        tolerance: options.tolerance ?? SEEK_DEFAULTS.tolerance,
        // Quality is a no-op for lossless output, so do not spend attempts on it.
        ...(isLossless(format)
          ? {
              floor: 1,
              ceil: 1,
              start: 1,
              maxShrinks: SEEK_DEFAULTS.maxShrinks,
            }
          : {}),
        signal: options.signal,
      },
    )

    // The silent one: an unsupported type yields PNG with no error anywhere.
    if (!didProduce(outcome.blob, format)) {
      degraded.push({
        kind: 'format',
        want: format,
        got: outcome.blob.type || 'unknown',
      })
    }

    if (outcome.shrinks > 0) {
      degraded.push({
        kind: 'dimension',
        reason: 'budget',
        from: capped,
        to: [outcome.width, outcome.height],
      })
    }

    if (options.maxBytes !== undefined && !outcome.withinBudget) {
      degraded.push({
        kind: 'overshoot',
        maxBytes: options.maxBytes,
        got: outcome.blob.size,
      })
    }

    return {
      blob: outcome.blob,
      format: outcome.blob.type || 'unknown',
      bytes: outcome.blob.size,
      width: outcome.width,
      height: outcome.height,
      engine: engine.id,
      attempts: outcome.attempts,
      degraded,
    }
  } finally {
    // Bitmaps hold decoded pixels off-heap; on iOS not closing them is how a
    // few large photos in a row become a blank canvas.
    source.close()
  }
}
