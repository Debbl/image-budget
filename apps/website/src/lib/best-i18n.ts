import { defineI18nConfig } from 'best-i18n/next/config'

// The site's own UI strings (landing page, metadata) go through best-i18n.
// The locale segment is fumadocs' `[lang]`, not the default `[locale]`.
export const i18nConfig = defineI18nConfig({
  locales: ['en', 'zh'],
  baseLocale: 'en',
  localeParam: 'lang',
})
