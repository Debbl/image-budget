import { describe, expect, it, vi } from 'vitest'
import { createPool } from '../src/worker/pool.ts'
import { blob, fakeWorkerFactory } from './helpers/fake-worker.ts'

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('createPool', () => {
  it('spawns nothing until there is work', () => {
    const { spawn, workers } = fakeWorkerFactory()
    createPool({ size: 4, spawn })

    expect(workers).toHaveLength(0)
  })

  it('spawns one worker for one job', async () => {
    const { spawn, workers } = fakeWorkerFactory()
    const pool = createPool({ size: 4, spawn })

    const running = pool.submit(blob(), { maxBytes: 1000 })
    expect(workers).toHaveLength(1)

    workers[0]!.finish(900)
    await expect(running).resolves.toMatchObject({ bytes: 900 })
  })

  it('grows only up to the point of contention', async () => {
    const { spawn, workers } = fakeWorkerFactory()
    const pool = createPool({ size: 2, spawn })

    const a = pool.submit(blob(), {})
    const b = pool.submit(blob(), {})
    expect(workers).toHaveLength(2)

    workers[0]!.finish()
    workers[1]!.finish()
    await Promise.all([a, b])

    // The third job reuses an idle worker rather than spawning a third.
    const c = pool.submit(blob(), {})
    expect(workers).toHaveLength(2)
    workers.find((worker) => worker.received.length === 2)?.finish()
    await c
  })

  it('queues past the pool size and drains as workers free up', async () => {
    const { spawn, workers } = fakeWorkerFactory()
    const pool = createPool({ size: 1, spawn })

    const first = pool.submit(blob(), {})
    const second = pool.submit(blob(), {})

    expect(workers).toHaveLength(1)
    expect(workers[0]!.received).toHaveLength(1)

    workers[0]!.finish(100)
    await first
    await tick()

    // Only now does the queued job reach the worker.
    expect(workers[0]!.received).toHaveLength(2)
    workers[0]!.finish(200)
    await expect(second).resolves.toMatchObject({ bytes: 200 })
  })

  it('rejects with the worker-side message', async () => {
    const { spawn, workers } = fakeWorkerFactory()
    const pool = createPool({ size: 1, spawn })

    const running = pool.submit(blob(), {})
    workers[0]!.failWith('codec exploded')

    await expect(running).rejects.toThrow('codec exploded')
  })

  it('relays an abort instead of trying to clone the signal', async () => {
    const { spawn, workers } = fakeWorkerFactory()
    const pool = createPool({ size: 1, spawn })
    const controller = new AbortController()

    void pool.submit(blob(), { signal: controller.signal })
    controller.abort()
    await tick()

    expect(workers[0]!.received).toContainEqual({ type: 'abort', id: 1 })
  })

  it('never sends the signal itself across the seam', async () => {
    const { spawn, workers } = fakeWorkerFactory()
    const pool = createPool({ size: 1, spawn })
    const controller = new AbortController()

    void pool.submit(blob(), { maxBytes: 500, signal: controller.signal })

    const sent = workers[0]!.received[0]
    expect(sent).toMatchObject({ type: 'compress' })
    expect(sent && 'options' in sent && sent.options).not.toHaveProperty(
      'signal',
    )
  })

  it('rejects immediately for an already-aborted signal', async () => {
    const { spawn, workers } = fakeWorkerFactory()
    const pool = createPool({ size: 1, spawn })

    await expect(
      pool.submit(blob(), { signal: AbortSignal.abort(new Error('nope')) }),
    ).rejects.toThrow('nope')
    expect(workers).toHaveLength(0)
  })

  it('terminate kills the workers and rejects everything outstanding', async () => {
    const { spawn, workers } = fakeWorkerFactory()
    const pool = createPool({ size: 1, spawn })

    const running = pool.submit(blob(), {})
    const queued = pool.submit(blob(), {})

    pool.terminate()

    await expect(running).rejects.toThrow('terminated')
    await expect(queued).rejects.toThrow('terminated')
    expect(workers[0]!.terminated).toBe(true)
  })

  it('refuses new work after terminate', async () => {
    const { spawn } = fakeWorkerFactory()
    const pool = createPool({ size: 1, spawn })
    pool.terminate()

    await expect(pool.submit(blob(), {})).rejects.toThrow('terminated')
  })

  it('ignores a stale response for a job that already settled', async () => {
    const { spawn, workers } = fakeWorkerFactory()
    const pool = createPool({ size: 1, spawn })
    const settled = vi.fn<() => void>()

    const running = pool.submit(blob(), {}).then(settled)
    workers[0]!.finish(100)
    await running

    // A second `done` for the same id must not resolve anything twice.
    expect(() => workers[0]!.finish(200)).toThrow('no job')
    expect(settled).toHaveBeenCalledTimes(1)
  })
})
