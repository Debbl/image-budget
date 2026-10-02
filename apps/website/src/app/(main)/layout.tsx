import { i18n } from '~/lib/i18n'
import { withGenerateMetadata, WithLayout } from '../layout.with'
import type { Metadata } from 'next'

export function generateMetadata(): Metadata {
  return withGenerateMetadata(i18n.defaultLanguage)
}

export default function Layout(props: { children: React.ReactNode }) {
  return WithLayout(i18n.defaultLanguage, props)
}
