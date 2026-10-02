import { describe, expect, it } from 'vitest'
import { runPipeline } from '../src/core/pipeline.ts'
import { blobOf, fakeBitmap, fakeEngine } from './helpers/fake.ts'
import type { Format } from '../src/types.ts'

const input = blobOf(4_000_000, 'image/jpeg')

function deps(engine = fakeEngine(), width = 1000, height = 800) {
  const { bitmap, isClosed } = fakeBitmap(width, height)
  return { deps: { decode: async () => bitmap, engine }, isClosed }
}

describe('runPipeline', () => {
  it('reports no degradation when the output is what was asked for', async () => {
    const { deps: d } = deps()
    const result = await runPipeline(input, { format: 'image/webp' }, d)

    expect(result.degraded).toEqual([])
    expect(result.format).toBe('image/webp')
    expect(result.engine).toBe('fake')
  })

  it('reads the format off the blob rather than echoing the request', async () => {
    // The silent one: the engine was asked for webp and produced png.
    const liar = fakeEngine({
      probe: async () => new Set<Format>(['image/webp']),
      attempt: async () => ({
        blob: blobOf(1000, 'image/png'),
        width: 1000,
        height: 800,
      }),
    })
    const { deps: d } = deps(liar)
    const result = await runPipeline(input, { format: 'image/webp' }, d)

    expect(result.format).toBe('image/png')
    expect(result.degraded).toContainEqual({
      kind: 'format',
      want: 'image/webp',
      got: 'image/png',
    })
  })

  it('reports a requested format the engine cannot emit', async () => {
    const { deps: d } = deps(
      fakeEngine({ probe: async () => new Set<Format>(['image/jpeg']) }),
    )
    const result = await runPipeline(input, { format: 'image/avif' }, d)

    expect(result.degraded).toContainEqual({
      kind: 'format',
      want: 'image/avif',
      got: 'image/jpeg',
    })
  })

  it('reports dropped EXIF instead of silently losing it', async () => {
    const { deps: d } = deps()
    const result = await runPipeline(input, { preserveExif: true }, d)

    expect(result.degraded).toContainEqual({
      kind: 'exif',
      reason: 'engine-cannot-preserve',
    })
  })

  it('stays quiet about EXIF when the engine can keep it', async () => {
    const { deps: d } = deps(fakeEngine({ preservesExif: true }))
    const result = await runPipeline(input, { preserveExif: true }, d)

    expect(result.degraded).toEqual([])
  })

  it('reports the engine pixel ceiling as a degradation, not a silent clamp', async () => {
    const { deps: d } = deps(
      fakeEngine({ safeMaxPixels: 1_000_000 }),
      4000,
      3000,
    )
    const result = await runPipeline(input, {}, d)

    expect(result.degraded).toContainEqual({
      kind: 'dimension',
      reason: 'engine-pixel-ceiling',
      from: [4000, 3000],
      to: [1154, 866],
    })
  })

  it('attributes a caller-requested resize to the budget, not the engine', async () => {
    const { deps: d } = deps(fakeEngine(), 4000, 3000)
    const result = await runPipeline(input, { maxDimension: 1000 }, d)

    const dimension = result.degraded.find(
      (entry) => entry.kind === 'dimension',
    )
    expect(dimension).toMatchObject({ reason: 'budget' })
  })

  it('reports an overshoot rather than throwing', async () => {
    const stubborn = fakeEngine({
      attempt: async (_source, plan) => ({
        blob: blobOf(900_000, plan.format),
        width: 1000,
        height: 800,
      }),
    })
    const { deps: d } = deps(stubborn)
    const result = await runPipeline(input, { maxBytes: 1000 }, d)

    expect(result.degraded).toContainEqual({
      kind: 'overshoot',
      maxBytes: 1000,
      got: 900_000,
    })
    // Still a usable result, not an exception.
    expect(result.blob.size).toBe(900_000)
  })

  it('spends no attempts on quality for a lossless format', async () => {
    let attempts = 0
    const png = fakeEngine({
      probe: async () => new Set<Format>(['image/png']),
      attempt: async (_source, plan) => {
        attempts += 1
        return { blob: blobOf(500, plan.format), width: 1000, height: 800 }
      },
    })
    const { deps: d } = deps(png)
    const result = await runPipeline(input, { maxBytes: 100_000 }, d)

    expect(attempts).toBe(1)
    expect(result.attempts).toBe(1)
  })

  it('closes the bitmap even when the engine throws', async () => {
    const broken = fakeEngine({
      attempt: async () => {
        throw new Error('codec exploded')
      },
    })
    const { deps: d, isClosed } = deps(broken)

    await expect(runPipeline(input, {}, d)).rejects.toThrow('codec exploded')
    expect(isClosed()).toBe(true)
  })

  it('closes the bitmap on success', async () => {
    const { deps: d, isClosed } = deps()
    await runPipeline(input, {}, d)
    expect(isClosed()).toBe(true)
  })
})
