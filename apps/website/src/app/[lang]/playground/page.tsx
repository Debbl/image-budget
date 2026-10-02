import { i18n } from '~/lib/i18n'
import { withGenerateMetadata, WithPage } from './page.with'
import type { Metadata } from 'next'

export function generateStaticParams() {
  return i18n.languages
    .filter((lang) => lang !== i18n.defaultLanguage)
    .map((lang) => ({ lang }))
}

export const dynamicParams = false

export async function generateMetadata(
  props: PageProps<'/[lang]/playground'>,
): Promise<Metadata> {
  const { lang } = await props.params
  return withGenerateMetadata(lang)
}

export default async function Page(props: PageProps<'/[lang]/playground'>) {
  const { lang } = await props.params
  return WithPage(lang)
}
