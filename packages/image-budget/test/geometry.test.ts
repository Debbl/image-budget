import { describe, expect, it } from 'vitest'
import { fit } from '../src/core/geometry.ts'

describe('fit', () => {
  it('leaves an image that already fits alone', () => {
    expect(fit(800, 600, 1920, 16_777_216)).toEqual([800, 600])
  })

  it('never scales up', () => {
    expect(fit(100, 100, 4000)).toEqual([100, 100])
  })

  it('caps the longest edge and keeps the aspect ratio', () => {
    expect(fit(4000, 2000, 1000)).toEqual([1000, 500])
    expect(fit(2000, 4000, 1000)).toEqual([500, 1000])
  })

  it('caps total pixels even when both edges look reasonable', () => {
    // 4096x8000 passes a 8192 edge cap but is 32M pixels - twice the iOS
    // ceiling, where Safari hands back a blank canvas instead of throwing.
    const [width, height] = fit(4096, 8000, 8192, 16_777_216)
    expect(width * height).toBeLessThanOrEqual(16_777_216)
    expect(width / height).toBeCloseTo(4096 / 8000, 2)
  })

  it('applies whichever cap binds harder', () => {
    expect(fit(4000, 3000, 1000, 16_777_216)).toEqual([1000, 750])
  })

  it('never returns a zero dimension', () => {
    const [width, height] = fit(10_000, 1, 1)
    expect(width).toBeGreaterThanOrEqual(1)
    expect(height).toBeGreaterThanOrEqual(1)
  })
})
