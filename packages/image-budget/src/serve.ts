/**
 * The worker half, for a worker file you own.
 *
 * Some bundlers will not follow a `new Worker(new URL(...))` that lives
 * inside a dependency - Turbopack stalls on it outright. Writing the worker
 * in your own source tree sidesteps that entirely, because the URL is then
 * ordinary application code:
 *
 * ```ts
 * // app/compress.worker.ts
 * import { serve } from 'image-budget/serve'
 * serve()
 * ```
 *
 * ```ts
 * import { createCompressor } from 'image-budget/worker'
 *
 * const compressor = createCompressor({
 *   spawn: () =>
 *     new Worker(new URL('./compress.worker.ts', import.meta.url), {
 *       type: 'module',
 *     }),
 * })
 * ```
 *
 * For AVIF, pass the engine in that file rather than configuring it here -
 * the codecs then load in the worker and nowhere else:
 *
 * ```ts
 * import { jsquashEngine } from 'image-budget/jsquash'
 * import { serve } from 'image-budget/serve'
 * serve(jsquashEngine)
 * ```
 */
export { serve } from './worker/serve.ts'
export type { Request, Response } from './worker/protocol.ts'
