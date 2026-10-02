'use client'

import { useI18n } from 'best-i18n/react/macro'
import { compress } from 'image-budget'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Result } from 'image-budget'
import type { ChangeEvent, DragEvent, ReactNode } from 'react'

// AVIF is deliberately absent: it needs the jSquash WASM engine, and
// `@jsquash/*` stalls a Turbopack production build - see docs/engines. This
// site is also a static export with no COOP/COEP, so AVIF would be
// single-threaded anyway.
type Format = 'auto' | 'image/webp' | 'image/jpeg' | 'image/png'

interface Settings {
  budgetKb: number
  format: Format
  maxDimension: number
}

interface Job {
  id: string
  file: File
  /** Undefined while the search is still running. */
  result?: Result
  /** Wall-clock for the whole compress call, not just the encodes. */
  ms?: number
  error?: string
  previewUrl: string
  resultUrl?: string
}

const DEFAULTS: Settings = {
  budgetKb: 150,
  format: 'auto',
  maxDimension: 2048,
}

export function Playground() {
  const t = useI18n()
  const [settings, setSettings] = useState(DEFAULTS)
  const [jobs, setJobs] = useState<Job[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Object URLs outlive React state, so they are revoked explicitly rather
  // than left for the tab to reclaim.
  const urls = useRef(new Set<string>())
  const track = useCallback((url: string) => {
    urls.current.add(url)
    return url
  }, [])
  useEffect(() => {
    const tracked = urls.current
    return () => {
      for (const url of tracked) URL.revokeObjectURL(url)
    }
  }, [])

  const run = useCallback(
    async (job: Job, using: Settings) => {
      const started = performance.now()
      try {
        const result = await compress(job.file, {
          maxBytes: using.budgetKb * 1024,
          maxDimension: using.maxDimension,
          format: using.format,
        })
        const ms = Math.round(performance.now() - started)
        const resultUrl = track(URL.createObjectURL(result.blob))

        setJobs((previous) =>
          previous.map((entry) =>
            entry.id === job.id
              ? { ...entry, result, ms, resultUrl, error: undefined }
              : entry,
          ),
        )
      } catch (cause) {
        setJobs((previous) =>
          previous.map((entry) =>
            entry.id === job.id
              ? {
                  ...entry,
                  result: undefined,
                  error: cause instanceof Error ? cause.message : String(cause),
                }
              : entry,
          ),
        )
      }
    },
    [track],
  )

  const add = useCallback(
    (files: File[]) => {
      const images = files.filter(
        (file) =>
          file.type.startsWith('image/') || /\.hei[cf]$/i.test(file.name),
      )
      if (images.length === 0) return

      const next = images.map((file) => ({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        previewUrl: track(URL.createObjectURL(file)),
      }))

      setJobs((previous) => [...previous, ...next])
      for (const job of next) void run(job, settings)
    },
    [run, settings, track],
  )

  // Re-run everything when a control changes - the same thing you would do in
  // an app, and it makes the attempt count visibly respond to the budget.
  const update = useCallback(
    (patch: Partial<Settings>) => {
      const next = { ...settings, ...patch }
      setSettings(next)
      setJobs((previous) =>
        previous.map((job) => ({
          ...job,
          result: undefined,
          error: undefined,
        })),
      )
      for (const job of jobs) void run(job, next)
    },
    [jobs, run, settings],
  )

  // Paste is the fastest way in from a screenshot tool.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = [...(event.clipboardData?.files ?? [])]
      if (files.length > 0) add(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [add])

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    add([...event.dataTransfer.files])
  }

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    add([...(event.target.files ?? [])])
    event.target.value = ''
  }

  const done = jobs.filter((job) => job.result)
  const totalIn = done.reduce((sum, job) => sum + job.file.size, 0)
  const totalOut = done.reduce((sum, job) => sum + (job.result?.bytes ?? 0), 0)

  return (
    <div className='not-prose flex flex-col gap-5'>
      <div className='flex flex-wrap items-end gap-5'>
        <Field label={t`Budget`}>
          <div className='flex items-center gap-1'>
            <input
              type='number'
              min={5}
              step={5}
              value={settings.budgetKb}
              onChange={(event) =>
                update({ budgetKb: Math.max(1, Number(event.target.value)) })
              }
              className='border-fd-border bg-fd-background w-24 rounded-md border px-2 py-1 text-sm'
            />
            <span className='text-fd-muted-foreground text-sm'>kB</span>
          </div>
        </Field>

        <Field label={t`Format`}>
          <select
            value={settings.format}
            onChange={(event) =>
              update({ format: event.target.value as Format })
            }
            className='border-fd-border bg-fd-background rounded-md border px-2 py-1 text-sm'
          >
            <option value='auto'>auto</option>
            <option value='image/webp'>image/webp</option>
            <option value='image/jpeg'>image/jpeg</option>
            <option value='image/png'>image/png</option>
          </select>
        </Field>

        <Field label={t`Longest edge`}>
          <select
            value={settings.maxDimension}
            onChange={(event) =>
              update({ maxDimension: Number(event.target.value) })
            }
            className='border-fd-border bg-fd-background rounded-md border px-2 py-1 text-sm'
          >
            {[1024, 2048, 4096].map((value) => (
              <option key={value} value={value}>
                {value} px
              </option>
            ))}
          </select>
        </Field>

        {done.length > 0 && (
          <div className='ml-auto text-sm'>
            <span className='text-fd-muted-foreground'>{kb(totalIn)} → </span>
            <span className='font-medium'>{kb(totalOut)}</span>
            <Saved from={totalIn} to={totalOut} />
          </div>
        )}
      </div>

      <button
        type='button'
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging
            ? 'border-fd-primary bg-fd-primary/5'
            : 'border-fd-border hover:border-fd-primary/50'
        }`}
      >
        <p className='font-medium'>{t`Drop, paste, or click to add images`}</p>
        <p className='text-fd-muted-foreground mt-1 text-sm'>
          {t`Several at once is fine. HEIC from an iPhone works. Nothing is uploaded - it all runs in this tab.`}
        </p>
      </button>

      <input
        ref={inputRef}
        type='file'
        multiple
        accept='image/*,.heic,.heif'
        onChange={onPick}
        className='hidden'
      />

      <p className='text-fd-muted-foreground text-sm'>
        {t`AVIF is not offered here: it needs the jSquash engine, which this statically exported site cannot bundle.`}
      </p>

      <div className='flex flex-col gap-4'>
        {jobs.map((job) => (
          <Card key={job.id} job={job} settings={settings} />
        ))}
      </div>
    </div>
  )
}

function Card({ job, settings }: { job: Job; settings: Settings }) {
  const t = useI18n()
  const { result } = job

  return (
    <div className='border-fd-border flex flex-col gap-3 rounded-xl border p-4'>
      <div className='flex items-baseline justify-between gap-3'>
        <span className='truncate text-sm font-medium'>{job.file.name}</span>
        <span className='text-fd-muted-foreground shrink-0 text-sm'>
          {kb(job.file.size)}
          {result && (
            <>
              {' → '}
              <span className='text-fd-foreground font-medium'>
                {kb(result.bytes)}
              </span>
              <Saved from={job.file.size} to={result.bytes} />
            </>
          )}
        </span>
      </div>

      {job.error && (
        <p className='text-sm text-red-500'>
          <code>{job.error}</code>
        </p>
      )}

      {!result && !job.error && (
        <p className='text-fd-muted-foreground text-sm'>{t`Encoding...`}</p>
      )}

      {result && (
        <>
          {/* One row saying what was asked for and what came back. Neutral
              chips are facts; amber chips are the ways it differs. */}
          <div className='flex flex-wrap gap-1.5'>
            <Chip label={t`Requested`} value={settings.format} />
            <Chip label={t`Final`} value={result.format} />
            <Chip label={t`Budget`} value={`≤ ${settings.budgetKb} kB`} />
            <Chip label={t`Size`} value={`${result.width}×${result.height}`} />
            <Chip label={t`Encodes`} value={String(result.attempts)} />
            {job.ms !== undefined && (
              <Chip label={t`Took`} value={`${job.ms} ms`} />
            )}
            {/* `t` is a compile-time macro: it only works at its own call
                site, so the mapping is inlined here rather than handed to a
                helper along with `t`. */}
            {result.degraded.map((entry) => (
              <Chip
                key={JSON.stringify(entry)}
                tone='warn'
                value={
                  entry.kind === 'format'
                    ? `${t`format`}: ${entry.want} → ${entry.got}`
                    : entry.kind === 'exif'
                      ? t`EXIF dropped`
                      : entry.kind === 'overshoot'
                        ? `${t`over budget`}: ${kb(entry.got)}`
                        : `${t`scaled`}: ${entry.from[0]}×${entry.from[1]} → ${entry.to[0]}×${entry.to[1]}`
                }
              />
            ))}
          </div>

          {result.degraded.length === 0 && (
            <p className='text-sm text-emerald-600 dark:text-emerald-400'>
              {t`Exactly what was requested.`}
            </p>
          )}

          <div className='grid grid-cols-2 gap-3'>
            <Preview label={t`Original`} src={job.previewUrl} />
            <Preview label={t`Result`} src={job.resultUrl} />
          </div>
        </>
      )}
    </div>
  )
}

function Chip({
  label,
  value,
  tone = 'neutral',
}: {
  label?: string
  value: string
  tone?: 'neutral' | 'warn'
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs ${
        tone === 'warn'
          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
          : 'bg-fd-muted text-fd-muted-foreground'
      }`}
    >
      {label && <span className='opacity-70'>{label} · </span>}
      <span className='font-medium'>{value}</span>
    </span>
  )
}

function Preview({ label, src }: { label: string; src?: string }) {
  return (
    <figure className='flex flex-col gap-1'>
      <figcaption className='text-fd-muted-foreground text-xs'>
        {label}
      </figcaption>
      {src ? (
        /* oxlint-disable-next-line next/no-img-element -- a blob: URL for an image the user just picked; next/image cannot optimise it and this site is a static export with no optimiser */
        <img
          src={src}
          alt=''
          className='border-fd-border max-h-56 w-full rounded-lg border object-contain'
        />
      ) : (
        <div className='border-fd-border h-56 rounded-lg border' />
      )}
    </figure>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className='flex flex-col gap-1'>
      <span className='text-fd-muted-foreground text-xs'>{label}</span>
      {children}
    </label>
  )
}

function Saved({ from, to }: { from: number; to: number }) {
  const saved = 1 - to / from
  if (saved <= 0) return null
  return (
    <span className='ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400'>
      -{(saved * 100).toFixed(0)}%
    </span>
  )
}

function kb(bytes: number) {
  return `${(bytes / 1024).toFixed(1)} kB`
}
