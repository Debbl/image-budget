import { i18n } from '~/lib/i18n'
import {
  withGenerateMetadata,
  WithPage,
} from '../../[lang]/playground/page.with'
import type { Metadata } from 'next'

export function generateMetadata(): Metadata {
  return withGenerateMetadata(i18n.defaultLanguage)
}

export default function Page() {
  return WithPage(i18n.defaultLanguage)
}
