import { t } from 'best-i18n/macro'
import { setRequestLocale } from 'best-i18n/next/server'
import { Playground } from '~/components/playground'
import { appName } from '~/lib/shared'
import type { Metadata } from 'next'

export function withGenerateMetadata(lang: string): Metadata {
  setRequestLocale(lang)

  return {
    title: t`Playground`,
    description: t`Squeeze an image under a byte budget in your own browser.`,
  }
}

export function WithPage(lang: string) {
  setRequestLocale(lang)

  return (
    <main className='mx-auto w-full max-w-3xl px-4 py-12'>
      <h1 className='mb-2 text-3xl font-bold'>{t`Playground`}</h1>
      <p className='text-fd-muted-foreground mb-8'>
        {t`Pick an image and watch the search run. Everything below is the real ${appName} running in this tab - no server, no upload.`}
      </p>
      <Playground />
    </main>
  )
}
