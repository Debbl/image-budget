import { i18n } from '~/lib/i18n'
import { appName, repoUrl } from './shared'
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'

export function baseOptions(locale: string): BaseLayoutProps {
  const prefix = locale === i18n.defaultLanguage ? '' : `/${locale}`

  return {
    nav: {
      title: appName,
      url: prefix || '/',
    },
    links: [
      { text: 'Docs', url: `${prefix}/docs` },
      { text: 'Playground', url: `${prefix}/playground` },
    ],
    githubUrl: repoUrl,
  }
}
