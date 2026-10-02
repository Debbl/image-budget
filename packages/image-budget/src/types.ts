export type Format = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif'

/** What one encode attempt produced, geometry included. */
export interface Attempt {
  blob: Blob
  width: number
  height: number
}

export interface Plan {
  format: Format
  /** 0..1. Engines map it onto their own scale. */
  quality: number
  maxDimension?: number
  maxPixels?: number
}

/**
 * An encoder. Deliberately single-shot: it encodes once at the quality it is
 * given and has no opinion about byte budgets - that search belongs to
 * `compress`, which is the only place it can be reported honestly.
 */
export interface Engine {
  id: string
  /** Whether output can carry the input's EXIF. Canvas and WASM codecs cannot. */
  preservesExif: boolean
  /** Largest pixel count this engine will attempt in one go. */
  safeMaxPixels: number
  /** Formats this engine can actually emit here, verified rather than assumed. */
  probe: () => Promise<ReadonlySet<Format>>
  attempt: (source: ImageBitmap, plan: Plan) => Promise<Attempt>
}

export type Decoder = (blob: Blob) => Promise<ImageBitmap>

/** Every way the result is not what was asked for. Empty means it is. */
export type Degradation =
  | { kind: 'format'; want: string; got: string }
  | { kind: 'exif'; reason: 'engine-cannot-preserve' }
  | { kind: 'overshoot'; maxBytes: number; got: number }
  | {
      kind: 'dimension'
      reason: 'engine-pixel-ceiling' | 'budget'
      from: readonly [number, number]
      to: readonly [number, number]
    }

export interface Options {
  /** Byte budget. Without it there is nothing to search for: one encode runs. */
  maxBytes?: number
  maxDimension?: number
  /** `'auto'` never flattens possible transparency. Default `'auto'`. */
  format?: Format | 'auto'
  preserveExif?: boolean
  /** Encode calls the search may spend. Default 6. */
  maxAttempts?: number
  /**
   * Stop as soon as a result lands in `[tolerance * maxBytes, maxBytes]`.
   * Default 0.85 - the last few percent of quality costs whole encodes, which
   * matters when one AVIF attempt is seconds.
   */
  tolerance?: number
  signal?: AbortSignal
  /** Default: the canvas engine. Pass the jSquash one for AVIF. */
  engine?: Engine
}

export interface Result {
  blob: Blob
  /** Read back from the blob, not the request. This is the point of the library. */
  format: string
  bytes: number
  width: number
  height: number
  engine: string
  attempts: number
  degraded: Degradation[]
}
