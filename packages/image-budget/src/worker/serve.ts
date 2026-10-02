import { compress } from '../index.ts'
import type { Engine } from '../types.ts'
import type { Request, Response, WorkerOptions } from './protocol.ts'

/**
 * The worker half, minus the choice of engine.
 *
 * Which engine a worker carries is fixed when it is spawned rather than
 * chosen per message, because a worker that *could* load jSquash has
 * `@jsquash/*` in its module graph whether or not anyone asks for AVIF - and
 * a graph containing those codecs is a graph some bundlers will not finish
 * building. One entry per engine keeps that cost where it is used.
 *
 * Nothing here touches the DOM: `createImageBitmap` and `OffscreenCanvas`
 * both exist in a worker, which is why the pipeline moved without changing
 * shape.
 */
interface WorkerScope {
  addEventListener: (
    type: 'message',
    handler: (event: { data: Request }) => void,
  ) => void
  postMessage: (message: Response) => void
}

export function serve(engine?: Engine) {
  const scope = globalThis as unknown as WorkerScope

  /** One controller per in-flight job, so an abort message can reach `seek`. */
  const inFlight = new Map<number, AbortController>()

  const run = async (id: number, input: Blob, options: WorkerOptions) => {
    const controller = new AbortController()
    inFlight.set(id, controller)

    try {
      const result = await compress(input, {
        ...options,
        engine,
        signal: controller.signal,
      })
      scope.postMessage({ type: 'done', id, result })
    } catch (cause) {
      scope.postMessage({
        type: 'fail',
        id,
        message: cause instanceof Error ? cause.message : String(cause),
      })
    } finally {
      inFlight.delete(id)
    }
  }

  scope.addEventListener('message', (event) => {
    const request = event.data

    if (request.type === 'abort') {
      inFlight.get(request.id)?.abort(new Error('image-budget: aborted'))
      return
    }

    void run(request.id, request.input, request.options)
  })
}
