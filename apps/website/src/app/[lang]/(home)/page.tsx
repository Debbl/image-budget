'use client'

import { Link } from 'best-i18n/next/navigation'
import { useI18n } from 'best-i18n/react/macro'
import { appName, repoUrl } from '~/lib/shared'

export default function HomePage() {
  const t = useI18n()

  const features = [
    {
      title: t`Silence becomes data`,
      body: t`Ask for AVIF and get PNG, and nothing throws. So the format is read back off the blob, and result.degraded is empty only when the output is exactly what you asked for.`,
    },
    {
      title: t`A byte budget, not a quality number`,
      body: t`Quality is bisected to the largest size that fits, then the image is shrunk if quality alone cannot get there. Two axes, a capped attempt count, and the count is reported.`,
    },
    {
      title: t`HEIC without shipping libheif`,
      body: t`Detected from the file's magic bytes, since iOS often leaves the mime type blank, and decoded through heic-to imported on demand.`,
    },
    {
      title: t`Zero dependencies by default`,
      body: t`The canvas engine is native. WASM codecs live behind a separate entry point, so AVIF costs a bundle only where it is used.`,
    },
  ]

  return (
    <main className='flex flex-1 flex-col items-center px-4 py-16 text-center'>
      <h1 className='mb-4 text-4xl font-bold'>{appName}</h1>
      <p className='text-fd-muted-foreground mb-8 max-w-2xl text-lg'>
        {t`Compress an image to a byte budget in the browser - and find out what actually happened.`}
      </p>
      <pre className='bg-fd-muted mb-8 rounded-lg px-6 py-3 text-sm'>
        <code>pnpm add {appName}</code>
      </pre>
      <div className='mb-16 flex flex-wrap justify-center gap-4'>
        <Link
          href='/playground'
          className='bg-fd-primary text-fd-primary-foreground rounded-full px-6 py-2 font-medium'
        >
          {t`Try it here`}
        </Link>
        <Link
          href='/docs'
          className='border-fd-border rounded-full border px-6 py-2 font-medium'
        >
          {t`Read the docs`}
        </Link>
        <a
          href={repoUrl}
          className='border-fd-border rounded-full border px-6 py-2 font-medium'
        >
          GitHub
        </a>
      </div>
      <div className='grid max-w-4xl gap-4 text-left sm:grid-cols-2'>
        {features.map((f) => (
          <div key={f.title} className='border-fd-border rounded-lg border p-5'>
            <h2 className='mb-2 font-semibold'>{f.title}</h2>
            <p className='text-fd-muted-foreground text-sm'>{f.body}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
