import type { Options, Result } from '../types.ts'

/**
 * What a worker can be asked for: `Options` minus the two fields that cannot
 * cross a postMessage boundary.
 *
 * `engine` holds functions, and functions do not survive structuredClone, so
 * it is configured on the compressor instead. `signal` is not cloneable
 * either; the caller still passes one and it is relayed as an abort message,
 * so cancellation behaves the same.
 */
export type WorkerOptions = Omit<Options, 'engine' | 'signal'>

export type Request =
  | { type: 'compress'; id: number; input: Blob; options: WorkerOptions }
  | { type: 'abort'; id: number }

export type Response =
  | { type: 'done'; id: number; result: Result }
  | { type: 'fail'; id: number; message: string }

/**
 * The slice of `Worker` this package uses.
 *
 * Structural rather than the DOM type so the pool can be driven by a fake in
 * tests - the queueing and abort relay are the parts worth testing, and
 * neither needs a real thread.
 */
export interface WorkerLike {
  postMessage: (message: Request) => void
  addEventListener: (
    type: 'message',
    handler: (event: { data: Response }) => void,
  ) => void
  terminate: () => void
}
