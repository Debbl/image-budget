import { createCompressor } from 'image-budget/worker'
import { useEffect, useRef, useState } from 'react'
import type { Result } from 'image-budget'

const BUDGET_KB = 200

// Vite understands `new Worker(new URL(...))` natively, so the worker file
// below is compiled and served for us. Next.js/Turbopack does not - see
// docs/engines.
function spawn() {
  return new Worker(new URL('./compress.worker.ts', import.meta.url), {
    type: 'module',
  }) as never
}

export function App() {
  const compressor = useRef<ReturnType<typeof createCompressor> | null>(null)
  compressor.current ??= createCompressor({ spawn, size: 2 })
  useEffect(() => () => compressor.current?.terminate(), [])

  const [results, setResults] = useState<
    Array<{ name: string; from: number; result: Result; ms: number }>
  >([])
  const [error, setError] = useState<string | null>(null)

  async function run(files: File[]) {
    setError(null)
    await Promise.all(
      files.map(async (file) => {
        const started = performance.now()
        try {
          const result = await compressor.current!.compress(file, {
            maxBytes: BUDGET_KB * 1024,
            maxDimension: 2048,
          })
          setResults((previous) => [
            ...previous,
            {
              name: file.name,
              from: file.size,
              result,
              ms: Math.round(performance.now() - started),
            },
          ])
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        }
      }),
    )
  }

  return (
    <main>
      <h1>image-budget / Vite + Worker</h1>
      <p>
        Every encode runs in a worker, two at a time. Budget: {BUDGET_KB} kB.
      </p>

      <input
        type='file'
        multiple
        accept='image/*,.heic,.heif'
        onChange={(event) => void run([...(event.target.files ?? [])])}
      />

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {results.map((entry) => (
        <section key={entry.name + entry.result.bytes}>
          <h2>{entry.name}</h2>
          <p>
            {kb(entry.from)} → <strong>{kb(entry.result.bytes)}</strong> ·{' '}
            {entry.result.format} · {entry.result.width}×{entry.result.height} ·{' '}
            {entry.result.attempts} encodes · {entry.ms} ms
          </p>
          {entry.result.degraded.length === 0 ? (
            <p>exactly as requested</p>
          ) : (
            <ul>
              {entry.result.degraded.map((item) => (
                <li key={JSON.stringify(item)}>
                  <code>{JSON.stringify(item)}</code>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </main>
  )
}

function kb(bytes: number) {
  return `${(bytes / 1024).toFixed(1)} kB`
}
