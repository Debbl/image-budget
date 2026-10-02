import defaultMdxComponents from 'fumadocs-ui/mdx'
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/page'
import { notFound } from 'next/navigation'
import { i18n } from '~/lib/i18n'
import { source } from '~/lib/source'
import type { Metadata } from 'next'

/**
 * Params for one locale. The `(main)` tree asks for the default language and
 * drops the `lang` key - its route has no such segment - while `[lang]` asks
 * for everything else.
 */
export function withGenerateStaticParams(lang: string) {
  const params = source.generateParams().filter((param) => param.lang === lang)

  return lang === i18n.defaultLanguage
    ? params.map(({ slug }) => ({ slug }))
    : params
}

export async function withGenerateMetadata(
  lang: string,
  props: { params: Promise<{ slug?: string[] }> },
): Promise<Metadata> {
  const { slug } = await props.params
  const page = source.getPage(slug, lang)
  if (!page) notFound()

  return {
    title: page.data.title,
    description: page.data.description,
  }
}

export async function WithPage(
  lang: string,
  props: { params: Promise<{ slug?: string[] }> },
) {
  const { slug } = await props.params
  const page = source.getPage(slug, lang)
  if (!page) notFound()

  const MDXContent = page.data.body

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXContent components={{ ...defaultMdxComponents }} />
      </DocsBody>
    </DocsPage>
  )
}
