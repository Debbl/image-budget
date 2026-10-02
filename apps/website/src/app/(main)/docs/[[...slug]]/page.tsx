import { i18n } from '~/lib/i18n'
import {
  withGenerateMetadata,
  withGenerateStaticParams,
  WithPage,
} from '../../../[lang]/docs/[[...slug]]/page.with'
import type { Metadata } from 'next'

export function generateStaticParams() {
  return withGenerateStaticParams(i18n.defaultLanguage)
}

export const dynamicParams = false

export async function generateMetadata(
  props: PageProps<'/docs/[[...slug]]'>,
): Promise<Metadata> {
  return withGenerateMetadata(i18n.defaultLanguage, props)
}

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  return WithPage(i18n.defaultLanguage, props)
}
