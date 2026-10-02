import type { Attempt, Engine, Format } from '../../src/types.ts'

export function blobOf(size: number, type = 'image/webp'): Blob {
  return new Blob([new Uint8Array(size)], { type })
}

/**
 * An encoder whose output size is a known function of quality, so the search
 * can be tested without a codec. Records every quality it was asked for.
 */
export function fakeEncoder(
  sizeAt: (quality: number, scale: number) => number,
  type: Format = 'image/webp',
) {
  const calls: Array<{ quality: number; scale: number }> = []

  const encode = async (quality: number, scale: number): Promise<Attempt> => {
    calls.push({ quality, scale })
    return {
      blob: blobOf(Math.round(sizeAt(quality, scale)), type),
      width: Math.round(1000 * scale),
      height: Math.round(800 * scale),
    }
  }

  return { encode, calls }
}

/** A bitmap stand-in: happy-dom has no ImageBitmap. */
export function fakeBitmap(width = 1000, height = 800) {
  const state = { closed: false }
  return {
    bitmap: {
      width,
      height,
      close: () => {
        state.closed = true
      },
    } as ImageBitmap,
    isClosed: () => state.closed,
  }
}

export function fakeEngine(overrides: Partial<Engine> = {}): Engine {
  return {
    id: 'fake',
    preservesExif: false,
    safeMaxPixels: Number.POSITIVE_INFINITY,
    probe: async () => new Set<Format>(['image/webp', 'image/jpeg']),
    attempt: async (_source, plan) => ({
      blob: blobOf(1000, plan.format),
      width: 1000,
      height: 800,
    }),
    ...overrides,
  }
}
