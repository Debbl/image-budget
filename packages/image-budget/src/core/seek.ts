import type { Attempt } from '../types.ts'

export interface SeekConfig {
  maxBytes?: number
  maxAttempts: number
  tolerance: number
  /** Quality range to search. Lossless formats should skip seeking entirely. */
  floor: number
  ceil: number
  /**
   * Where the first probe lands. 0.75 is a better prior for photographs than
   * the midpoint, so the usual case converges an attempt or two sooner.
   */
  start: number
  /** Dimension halvings allowed once the quality axis is exhausted. */
  maxShrinks: number
  signal?: AbortSignal
}

export interface SeekOutcome extends Attempt {
  quality: number
  attempts: number
  /** How many times the image was halved to get under budget. */
  shrinks: number
  /** False when even floor quality at the smallest size overshot. */
  withinBudget: boolean
}

export const SEEK_DEFAULTS = {
  maxAttempts: 6,
  tolerance: 0.85,
  floor: 0.3,
  ceil: 0.95,
  start: 0.75,
  maxShrinks: 2,
} as const

interface Candidate extends Attempt {
  quality: number
  shrinks: number
}

/**
 * Find the highest quality whose output fits `maxBytes`.
 *
 * Takes the encoder as a parameter, so the search is pure with respect to
 * images: a fake returning blobs of a known size exercises every branch with
 * no canvas, no codec and no fixture.
 *
 * Three things the shape has to respect:
 *
 * - Bytes are only *roughly* monotonic in quality, so the best fitting
 *   attempt seen is kept rather than the last one computed.
 * - Quality has a floor. Past it the only remaining axis is pixels, so the
 *   image is halved and the search restarts - two dimensions, not one.
 * - Reaching that second axis has to stay affordable. Bisecting a range whose
 *   floor already overshoots burns the whole attempt budget on a question
 *   answered by one encode, and the shrink is then never tried. So each round
 *   probes `start`, then `floor`, and only bisects between two known points.
 */
export async function seek(
  encode: (quality: number, scale: number) => Promise<Attempt>,
  config: SeekConfig,
): Promise<SeekOutcome> {
  const { maxBytes, tolerance, floor, ceil, maxAttempts, maxShrinks } = config

  let attempts = 0
  /** Smallest output produced so far, whatever its quality - the fallback. */
  let smallest: Candidate | undefined

  const run = async (quality: number, shrinks: number): Promise<Candidate> => {
    if (config.signal?.aborted) {
      throw config.signal.reason ?? new Error('aborted')
    }
    attempts += 1
    const attempt = await encode(quality, 1 / 2 ** shrinks)
    const candidate = { ...attempt, quality, shrinks }
    if (!smallest || candidate.blob.size < smallest.blob.size) {
      smallest = candidate
    }
    return candidate
  }

  // No budget means there is nothing to search for.
  if (maxBytes === undefined) {
    const only = await run(ceil, 0)
    return { ...only, attempts, withinBudget: true }
  }

  const budget = maxBytes
  /** Encodes still affordable. A function because `attempts` moves inside `run`. */
  const remaining = () => maxAttempts - attempts

  /** Climb from a known-fitting `best` towards `hi`, which is known to be too big. */
  const refine = async (
    fitting: Candidate,
    lo: number,
    hi: number,
    shrinks: number,
  ): Promise<Candidate> => {
    let best = fitting
    let low = lo
    let high = hi

    while (remaining() > 0 && best.blob.size < tolerance * budget) {
      const next = (low + high) / 2
      if (next - low < 0.01 || high - next < 0.01) break

      const candidate = await run(next, shrinks)
      if (candidate.blob.size <= budget) {
        if (candidate.quality > best.quality) best = candidate
        low = next
      } else {
        high = next
      }
    }

    return best
  }

  for (let shrinks = 0; shrinks <= maxShrinks; shrinks++) {
    if (remaining() <= 0) break

    const seeded = await run(config.start, shrinks)
    if (seeded.blob.size <= budget) {
      const best = await refine(seeded, config.start, ceil, shrinks)
      return { ...best, attempts, withinBudget: true }
    }

    // `start` overshot. One more encode settles whether any quality can fit
    // at this size, instead of bisecting a range that may have no solution.
    if (floor >= config.start || remaining() <= 0) continue

    const grounded = await run(floor, shrinks)
    if (grounded.blob.size <= budget) {
      const best = await refine(grounded, floor, config.start, shrinks)
      return { ...best, attempts, withinBudget: true }
    }
  }

  // Everything overshot. Hand back the smallest thing we actually made and let
  // the caller decide - throwing would force a try/catch around a real result.
  return { ...smallest!, attempts, withinBudget: false }
}
