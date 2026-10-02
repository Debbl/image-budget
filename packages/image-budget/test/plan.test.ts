import { describe, expect, it } from 'vitest'
import { isLossless, mayHaveAlpha, pickFormat } from '../src/core/plan.ts'
import type { Format } from '../src/types.ts'

const all = new Set<Format>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
])

describe('mayHaveAlpha', () => {
  it('treats JPEG as the only provably opaque input', () => {
    expect(mayHaveAlpha('image/jpeg')).toBe(false)
    expect(mayHaveAlpha('image/png')).toBe(true)
    expect(mayHaveAlpha('image/webp')).toBe(true)
    // Unknown or empty type - iOS does this - must stay conservative.
    expect(mayHaveAlpha('')).toBe(true)
  })
})

describe('pickFormat', () => {
  it('honours an explicit supported format', () => {
    expect(pickFormat('image/avif', 'image/jpeg', all)).toBe('image/avif')
  })

  it('falls back when the requested format is unsupported', () => {
    const noAvif = new Set<Format>(['image/jpeg', 'image/png', 'image/webp'])
    expect(pickFormat('image/avif', 'image/jpeg', noAvif)).toBe('image/webp')
  })

  it('never flattens a possibly transparent input under auto', () => {
    const noWebp = new Set<Format>(['image/jpeg', 'image/png'])
    // PNG in, JPEG available and much smaller - but alpha would be painted over.
    expect(pickFormat('auto', 'image/png', noWebp)).toBe('image/png')
  })

  it('will convert an opaque input to JPEG under auto', () => {
    const noWebp = new Set<Format>(['image/jpeg', 'image/png'])
    expect(pickFormat('auto', 'image/jpeg', noWebp)).toBe('image/jpeg')
  })

  it('prefers webp under auto when it is available', () => {
    expect(pickFormat('auto', 'image/jpeg', all)).toBe('image/webp')
    expect(pickFormat('auto', 'image/png', all)).toBe('image/webp')
  })

  it('honours an explicit lossy request even for a transparent input', () => {
    // The caller said JPEG. Flattening is then their decision, not a silent one.
    expect(pickFormat('image/jpeg', 'image/png', all)).toBe('image/jpeg')
  })

  it('lands on PNG when nothing else can be emitted', () => {
    expect(pickFormat('auto', 'image/gif', new Set())).toBe('image/png')
  })
})

describe('isLossless', () => {
  it('knows quality is a no-op for PNG', () => {
    expect(isLossless('image/png')).toBe(true)
    expect(isLossless('image/webp')).toBe(false)
  })
})
