import { describe, expect, it } from 'vitest'
import { isHeic } from '../src/decode/index.ts'

/** An ISO-BMFF header: 4 size bytes, `ftyp`, then the brand. */
function ftyp(brand: string): Blob {
  const bytes = new Uint8Array(12)
  bytes.set([0, 0, 0, 12], 0)
  bytes.set(
    [...'ftyp'].map((c) => c.charCodeAt(0)),
    4,
  )
  bytes.set(
    [...brand].map((c) => c.charCodeAt(0)),
    8,
  )
  return new Blob([bytes])
}

describe('isHeic', () => {
  it('recognises the brands iOS actually writes', async () => {
    for (const brand of ['heic', 'heix', 'mif1', 'msf1', 'hevc']) {
      expect(await isHeic(ftyp(brand))).toBe(true)
    }
  })

  it('rejects other ISO-BMFF files', async () => {
    // An MP4 is the same container with a different brand.
    expect(await isHeic(ftyp('isom'))).toBe(false)
    expect(await isHeic(ftyp('mp42'))).toBe(false)
  })

  it('rejects a JPEG', async () => {
    const jpeg = new Blob([
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]),
    ])
    expect(await isHeic(jpeg)).toBe(false)
  })

  it('does not read past the end of a tiny blob', async () => {
    expect(await isHeic(new Blob([new Uint8Array(4)]))).toBe(false)
    expect(await isHeic(new Blob([]))).toBe(false)
  })

  it('ignores the declared mime type, which iOS often leaves empty', async () => {
    const heicWithNoType = new Blob([await ftyp('heic').arrayBuffer()], {
      type: '',
    })
    expect(await isHeic(heicWithNoType)).toBe(true)
  })
})
