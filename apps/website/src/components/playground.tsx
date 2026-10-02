'use client'

import { useI18n } from 'best-i18n/react/macro'
import { compress } from 'image-budget'
import { useState } from 'react'
import type { Result } from 'image-budget'

const PRESETS = [
  { label: '50 kB', maxBytes: 50 * 1024 },
  { label: '150 kB', maxBytes: 150 * 1024 },
  { label: '500 kB', maxBytes: 500 * 1024 },
] as const

// AVIF is deliberately absent: it needs the jSquash WASM engine, and
// `@jsquash/*` stalls a Turbopack production build - see docs/engines. This
// site is also a static export with no COOP/COEP, so AVIF would be
// single-threaded anyway.
type Formats = 'auto' | 'image/jpeg' | 'image/webp'

export function Playground() {
  const t = useI18n()

  const [budget, setBudget] = useState<number>(PRESETS[1].maxBytes)
  const [format, setFormat] = useState<Formats>('auto')
  const [original, setOriginal] = useState<{
    name: string
    bytes: number
  } | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(file: File) {
    setBusy(true)
    setError(null)
    setOriginal({ name: file.name, bytes: file.size })

    try {
      const next = await compress(file, {
        maxBytes: budget,
        maxDimension: 2048,
        format,
      })

      setResult(next)
      setUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous)
        return URL.createObjectURL(next.blob)
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='not-prose flex flex-col gap-6'>
      <div className='flex flex-wrap items-center gap-6'>
        <label className='flex items-center gap-2 text-sm'>
          <span className='text-fd-muted-foreground'>{t`Budget`}</span>
          <select
            value={budget}
            onChange={(event) => setBudget(Number(event.target.value))}
            className='border-fd-border bg-fd-background rounded-md border px-2 py-1'
          >
            {PRESETS.map((preset) => (
              <option key={preset.label} value={preset.maxBytes}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        <label className='flex items-center gap-2 text-sm'>
          <span className='text-fd-muted-foreground'>{t`Format`}</span>
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value as Formats)}
            className='border-fd-border bg-fd-background rounded-md border px-2 py-1'
          >
            <option value='auto'>auto</option>
            <option value='image/webp'>image/webp</option>
            <option value='image/jpeg'>image/jpeg</option>
          </select>
        </label>
      </div>

      <input
        type='file'
        accept='image/*,.heic,.heif'
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void run(file)
        }}
        className='border-fd-border rounded-lg border border-dashed p-6 text-sm'
      />

      <p className='text-fd-muted-foreground text-sm'>
        {t`Nothing is uploaded - the whole thing runs in this tab. HEIC from an iPhone works too.`}
      </p>
      <p className='text-fd-muted-foreground text-sm'>
        {t`AVIF is not offered here: it needs the jSquash engine, which this statically exported site cannot bundle.`}
      </p>

      {busy && <p className='text-sm'>{t`Encoding...`}</p>}

      {error && (
        <p className='text-sm text-red-500'>
          <code>{error}</code>
        </p>
      )}

      {result && original && (
        <Report original={original} result={result} url={url} />
      )}
    </div>
  )
}

function Report({
  original,
  result,
  url,
}: {
  original: { name: string; bytes: number }
  result: Result
  url: string | null
}) {
  const t = useI18n()
  const saved = 1 - result.bytes / original.bytes

  return (
    <div className='flex flex-col gap-4'>
      <dl className='grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3'>
        <Stat label={t`Original`} value={kb(original.bytes)} />
        <Stat label={t`Result`} value={kb(result.bytes)} />
        <Stat
          label={t`Saved`}
          value={saved > 0 ? `${(saved * 100).toFixed(0)}%` : '-'}
        />
        <Stat label={t`Format`} value={result.format} />
        <Stat
          label={t`Dimensions`}
          value={`${result.width}x${result.height}`}
        />
        <Stat
          label={t`Encodes`}
          value={`${result.attempts} (${result.engine})`}
        />
      </dl>

      {/* An empty list is the good case. Everything here would otherwise have
          happened silently. */}
      {result.degraded.length === 0 ? (
        <p className='rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm'>
          {t`Exactly what was requested.`}
        </p>
      ) : (
        <div className='rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm'>
          <p className='mb-2 font-medium'>{t`Not quite what was requested:`}</p>
          <ul className='flex flex-col gap-1'>
            {result.degraded.map((entry) => (
              <li key={JSON.stringify(entry)}>
                <code className='text-xs'>{JSON.stringify(entry)}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {url && (
        /* oxlint-disable-next-line next/no-img-element -- a blob: URL for an
           image the user just picked. next/image cannot optimise it, and this
           site is a static export with no optimiser at all. */
        <img
          src={url}
          alt=''
          className='border-fd-border max-h-96 w-auto rounded-lg border object-contain'
        />
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className='text-fd-muted-foreground text-xs'>{label}</dt>
      <dd className='font-medium'>{value}</dd>
    </div>
  )
}

function kb(bytes: number) {
  return `${(bytes / 1024).toFixed(1)} kB`
}
