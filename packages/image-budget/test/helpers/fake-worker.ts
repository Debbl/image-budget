import type {
  Request,
  Response,
  WorkerLike,
} from '../../src/worker/protocol.ts'

export interface FakeWorker extends WorkerLike {
  /** Everything this worker was sent, in order. */
  received: Request[]
  /** Complete the job it is currently holding. */
  finish: (bytes?: number) => void
  failWith: (message: string) => void
  terminated: boolean
}

export function fakeWorkerFactory() {
  const workers: FakeWorker[] = []

  const spawn = (): FakeWorker => {
    const handlers: Array<(event: { data: Response }) => void> = []
    const received: Request[] = []
    let current: number | undefined

    const worker: FakeWorker = {
      received,
      terminated: false,
      postMessage: (message) => {
        received.push(message)
        if (message.type === 'compress') current = message.id
      },
      addEventListener: (_type, handler) => handlers.push(handler),
      terminate: () => {
        worker.terminated = true
      },
      finish: (bytes = 1000) => {
        const id = current
        if (id === undefined) throw new Error('fake worker has no job')
        current = undefined
        for (const handler of handlers) {
          handler({
            data: {
              type: 'done',
              id,
              result: {
                blob: new Blob([new Uint8Array(bytes)], { type: 'image/webp' }),
                format: 'image/webp',
                bytes,
                width: 100,
                height: 100,
                engine: 'fake',
                attempts: 1,
                degraded: [],
              },
            },
          })
        }
      },
      failWith: (message) => {
        const id = current
        if (id === undefined) throw new Error('fake worker has no job')
        current = undefined
        for (const handler of handlers) {
          handler({ data: { type: 'fail', id, message } })
        }
      },
    }

    workers.push(worker)
    return worker
  }

  return { spawn, workers }
}

export const blob = () => new Blob([new Uint8Array(10)], { type: 'image/jpeg' })
