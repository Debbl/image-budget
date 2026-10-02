import { createPool } from './worker/pool.ts'
import type { Result } from './types.ts'
import type { WorkerLike, WorkerOptions } from './worker/protocol.ts'

export type { WorkerLike, WorkerOptions } from './worker/protocol.ts'

export interface CompressorConfig {
  /**
   * How many workers may run at once. Defaults to two, or one on a
   * single-core machine - encoding is CPU-bound, so more threads than cores
   * only adds contention.
   */
  size?: number
  /**
   * Build a worker. The default uses the `new Worker(new URL(...))` form every
   * major bundler understands. Override it when yours does not - the same
   * escape hatch the engine seam provides, for the same reason.
   */
  spawn?: () => WorkerLike
}

export interface Compressor {
  /**
   * Same contract as `compress`, minus the two options that cannot cross a
   * postMessage boundary: `engine` belongs to the compressor, and `signal` is
   * relayed instead of cloned.
   */
  compress: (
    input: Blob,
    options?: WorkerOptions & { signal?: AbortSignal },
  ) => Promise<Result>
  /** Kills the workers and rejects anything still queued. */
  terminate: () => void
}

function defaultSpawn(): WorkerLike {
  // Exactly one literal `new URL(...)`, and it points at the canvas-only
  // worker. A second one for jSquash would make every bundler emit the WASM
  // assets too, for every app, whether or not AVIF is ever asked for - so the
  // AVIF worker is a file you write, with `serve(jsquashEngine)` in it.
  //
  // Cast because `WorkerLike` is deliberately the narrow slice this package
  // uses: a real Worker satisfies it, but its DOM type is far wider.
  return new Worker(new URL('./worker-entry.mjs', import.meta.url), {
    type: 'module',
  }) as unknown as WorkerLike
}

function defaultSize(): number {
  const cores =
    typeof navigator === 'undefined' ? 2 : (navigator.hardwareConcurrency ?? 2)
  return Math.max(1, Math.min(2, cores))
}

/**
 * Move compression off the main thread.
 *
 * The pipeline itself is unchanged - it only ever used `createImageBitmap`,
 * `OffscreenCanvas` and `Blob`, all of which exist in a worker and all of
 * which are transferable. Placement was never an interface decision, which is
 * why this module is a wrapper rather than a second implementation.
 *
 * ```ts
 * import { createCompressor } from 'image-budget/worker'
 *
 * const compressor = createCompressor()
 * const result = await compressor.compress(file, { maxBytes: 200 * 1024 })
 * compressor.terminate()
 * ```
 */
export function createCompressor(config: CompressorConfig = {}): Compressor {
  const pool = createPool({
    size: config.size ?? defaultSize(),
    spawn: config.spawn ?? defaultSpawn,
  })

  return {
    compress: (input, options = {}) => pool.submit(input, options),
    terminate: pool.terminate,
  }
}
