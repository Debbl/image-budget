import { t } from 'best-i18n/macro'
import { setRequestLocale } from 'best-i18n/next/server'
import { LocaleProvider } from 'best-i18n/react'
import { Provider } from '~/components/provider'
import { i18nConfig } from '~/lib/best-i18n'
import { appName, siteUrl } from '~/lib/shared'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Both route trees render the same <html>; only the locale differs. Keeping
// the body here means `(main)/layout.tsx` and `[lang]/layout.tsx` stay as thin
// as the routing difference between them actually is.
export function withGenerateMetadata(lang: string): Metadata {
  setRequestLocale(lang)

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: appName,
      template: `%s | ${appName}`,
    },
    description: t`Compress an image to a byte budget in the browser, and find out what actually happened.`,
  }
}

export function WithLayout(
  lang: string,
  { children }: { children: ReactNode },
) {
  return (
    <html lang={lang} suppressHydrationWarning>
      <body className='flex min-h-screen flex-col'>
        <LocaleProvider locale={lang} config={i18nConfig}>
          <Provider lang={lang}>{children}</Provider>
        </LocaleProvider>
      </body>
    </html>
  )
}
