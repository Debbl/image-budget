import { describe, expect, it } from 'vitest'
import { SEEK_DEFAULTS, seek } from '../src/core/seek.ts'
import { blobOf, fakeEncoder } from './helpers/fake.ts'

const config = { ...SEEK_DEFAULTS }

// Size grows with quality and with area - the shape a real codec has.
const realistic = (quality: number, scale: number) =>
  200_000 * quality * scale ** 2

describe('seek', () => {
  it('encodes once when there is no budget to search for', async () => {
    const { encode, calls } = fakeEncoder(realistic)
    const outcome = await seek(encode, config)

    expect(calls).toHaveLength(1)
    expect(outcome.quality).toBe(config.ceil)
    expect(outcome.attempts).toBe(1)
  })

  it('lands inside the budget', async () => {
    const { encode } = fakeEncoder(realistic)
    const maxBytes = 100_000
    const outcome = await seek(encode, { ...config, maxBytes })

    expect(outcome.withinBudget).toBe(true)
    expect(outcome.blob.size).toBeLessThanOrEqual(maxBytes)
  })

  it('stops early once inside the tolerance band', async () => {
    const { encode, calls } = fakeEncoder(realistic)
    // start quality 0.75 gives 150_000, which fits a 160_000 budget at 93%.
    const outcome = await seek(encode, { ...config, maxBytes: 160_000 })

    expect(calls).toHaveLength(1)
    expect(outcome.attempts).toBe(1)
  })

  it('never spends more than maxAttempts encodes', async () => {
    const { encode, calls } = fakeEncoder(realistic)
    await seek(encode, { ...config, maxBytes: 100_001, maxAttempts: 3 })

    expect(calls.length).toBeLessThanOrEqual(3)
  })

  it('keeps the best fitting attempt when size is not monotonic', async () => {
    // A dip: quality 0.6 encodes smaller than 0.45, as real codecs sometimes do.
    const sizes = new Map([
      [0.75, 120_000],
      [0.525, 90_000],
      [0.6375, 80_000],
    ])
    const { encode } = fakeEncoder((quality) => sizes.get(quality) ?? 95_000)

    const outcome = await seek(encode, {
      ...config,
      maxBytes: 100_000,
      tolerance: 0.99,
    })

    expect(outcome.withinBudget).toBe(true)
    expect(outcome.blob.size).toBeLessThanOrEqual(100_000)
    // The highest quality that fit, not the last one tried.
    expect(outcome.quality).toBeGreaterThanOrEqual(0.525)
  })

  it('shrinks the image when floor quality still overshoots', async () => {
    // Only a quarter-area image can fit, at any quality.
    const { encode, calls } = fakeEncoder((quality, scale) =>
      scale < 1 ? 50_000 * quality : 900_000 * quality,
    )

    const outcome = await seek(encode, { ...config, maxBytes: 60_000 })

    expect(outcome.withinBudget).toBe(true)
    expect(outcome.shrinks).toBeGreaterThan(0)
    expect(outcome.width).toBeLessThan(1000)
    expect(calls.some((call) => call.scale < 1)).toBe(true)
  })

  it('returns the smallest attempt it made rather than throwing', async () => {
    const { encode } = fakeEncoder(() => 5_000_000)
    const outcome = await seek(encode, { ...config, maxBytes: 1000 })

    expect(outcome.withinBudget).toBe(false)
    expect(outcome.blob.size).toBe(5_000_000)
  })

  it('honours an abort signal between attempts', async () => {
    const controller = new AbortController()
    const { encode } = fakeEncoder(() => {
      controller.abort(new Error('cancelled'))
      return 900_000
    })

    await expect(
      seek(encode, { ...config, maxBytes: 1000, signal: controller.signal }),
    ).rejects.toThrow('cancelled')
  })

  it('does not treat an exactly-on-budget result as an overshoot', async () => {
    const { encode } = fakeEncoder(() => 100_000)
    const outcome = await seek(encode, { ...config, maxBytes: 100_000 })

    expect(outcome.withinBudget).toBe(true)
    expect(outcome.blob.size).toBe(100_000)
  })

  it('reports the size of the blob it returns', async () => {
    const { encode } = fakeEncoder(realistic)
    const outcome = await seek(encode, { ...config, maxBytes: 100_000 })

    expect(outcome.blob.size).toBe(blobOf(outcome.blob.size).size)
  })
})
