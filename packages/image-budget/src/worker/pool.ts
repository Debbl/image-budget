import type { Result } from '../types.ts'
import type {
  Request,
  Response,
  WorkerLike,
  WorkerOptions,
} from './protocol.ts'

interface Job {
  id: number
  input: Blob
  options: WorkerOptions
  signal?: AbortSignal
  resolve: (result: Result) => void
  reject: (error: Error) => void
}

interface Slot {
  worker: WorkerLike
  /** The job this worker is currently running, if any. */
  job?: Job
}

export interface PoolConfig {
  size: number
  spawn: () => WorkerLike
}

export interface Pool {
  submit: (
    input: Blob,
    options: WorkerOptions & { signal?: AbortSignal },
  ) => Promise<Result>
  terminate: () => void
}

/**
 * Hand a job to a worker, and wire the caller's signal to an abort message.
 *
 * The signal cannot be cloned, so it is relayed: the worker holds its own
 * controller and `seek` sees an abort exactly as it would on this thread.
 */
function start(slot: Slot, job: Job) {
  slot.job = job

  job.signal?.addEventListener(
    'abort',
    () => {
      if (slot.job?.id === job.id) {
        slot.worker.postMessage({ type: 'abort', id: job.id })
      }
    },
    { once: true },
  )

  const request: Request = {
    type: 'compress',
    id: job.id,
    input: job.input,
    options: job.options,
  }
  slot.worker.postMessage(request)
}

/**
 * A fixed set of workers with a queue in front.
 *
 * Workers are spawned lazily and only up to the first point of contention, so
 * a page that compresses one image pays for one thread rather than four.
 */
export function createPool({ size, spawn }: PoolConfig): Pool {
  const slots: Slot[] = []
  const queue: Job[] = []
  let nextId = 1
  let terminated = false

  function settle(slot: Slot, response: Response) {
    const job = slot.job
    if (!job || job.id !== response.id) return

    slot.job = undefined
    if (response.type === 'done') job.resolve(response.result)
    else job.reject(new Error(response.message))

    pump()
  }

  function attach(): Slot {
    const slot: Slot = { worker: spawn() }
    slot.worker.addEventListener('message', (event) => settle(slot, event.data))
    slots.push(slot)
    return slot
  }

  function pump() {
    while (queue.length > 0) {
      const idle = slots.find((slot) => !slot.job)
      const slot = idle ?? (slots.length < size ? attach() : undefined)
      if (!slot) return

      start(slot, queue.shift()!)
    }
  }

  return {
    submit: (input, { signal, ...options }) =>
      new Promise<Result>((resolve, reject) => {
        if (terminated) {
          reject(new Error('image-budget: compressor already terminated'))
          return
        }
        if (signal?.aborted) {
          reject(signal.reason ?? new Error('image-budget: aborted'))
          return
        }

        queue.push({ id: nextId++, input, options, signal, resolve, reject })
        pump()
      }),

    terminate: () => {
      terminated = true
      for (const slot of slots) {
        slot.job?.reject(new Error('image-budget: compressor terminated'))
        slot.worker.terminate()
      }
      slots.length = 0
      for (const job of queue.splice(0)) {
        job.reject(new Error('image-budget: compressor terminated'))
      }
    },
  }
}
