import { compress } from 'image-budget'
import { useState } from 'react'
import type { Result } from 'image-budget'

const BUDGET_KB = 200

export function App() {
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [original, setOriginal] = useState<number | null>(null)

  async function onPick(file: File) {
    setBusy(true)
    setError(null)
    setOriginal(file.size)
    try {
      setResult(
        await compress(file, {
          maxBytes: BUDGET_KB * 1024,
          maxDimension: 2048,
        }),
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main>
      <h1>image-budget</h1>
      <p>
        Pick an image. It gets squeezed under {BUDGET_KB} kB - HEIC included.
      </p>

      <input
        type='file'
        accept='image/*,.heic,.heif'
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void onPick(file)
        }}
      />

      {busy && <p>working...</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {result && (
        <>
          <table>
            <tbody>
              <Row label='original' value={kb(original ?? 0)} />
              <Row label='result' value={kb(result.bytes)} />
              <Row label='format' value={result.format} />
              <Row label='size' value={`${result.width} x ${result.height}`} />
              <Row label='engine' value={result.engine} />
              <Row label='encodes' value={String(result.attempts)} />
            </tbody>
          </table>

          {/* The whole point of the library: an empty list is the good case. */}
          {result.degraded.length === 0 ? (
            <p>exactly as requested</p>
          ) : (
            <ul>
              {result.degraded.map((entry) => (
                <li key={entry.kind + JSON.stringify(entry)}>
                  <code>{JSON.stringify(entry)}</code>
                </li>
              ))}
            </ul>
          )}

          <img
            src={URL.createObjectURL(result.blob)}
            alt=''
            style={{ maxWidth: '100%' }}
          />
        </>
      )}
    </main>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td>{label}</td>
      <td>
        <strong>{value}</strong>
      </td>
    </tr>
  )
}

function kb(bytes: number) {
  return `${(bytes / 1024).toFixed(1)} kB`
}
