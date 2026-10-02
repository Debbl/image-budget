'use client'

import { localizePathname } from 'best-i18n/locale-url'
import { defineI18nUI } from 'fumadocs-ui/i18n'
import { RootProvider } from 'fumadocs-ui/provider/next'
import { usePathname, useRouter } from 'next/navigation'
import { i18nConfig } from '~/lib/best-i18n'
import { i18n } from '~/lib/i18n'
import type { ReactNode } from 'react'

const { provider } = defineI18nUI(i18n, {
  en: {
    displayName: 'English',
  },
  zh: {
    'displayName': '简体中文',
    'Search(search dialog)': '搜索文档',
    'Search(search trigger)': '搜索',
    'No results found(search dialog)': '没有找到相关内容',
    'On this page(table of contents)': '本页目录',
    'No Headings(table of contents)': '暂无目录',
    'Edit on GitHub(edit page)': '在 GitHub 上编辑',
    'Last updated on(page footer)': '最后更新于',
    'Previous Page(pagination)': '上一页',
    'Next Page(pagination)': '下一页',
    'Page Not Found(404 page)': '页面不存在',
    'Back to Home(404 page)': '返回首页',
    'Choose a language(language switcher)': '选择语言',
  },
})

export function Provider({
  lang,
  children,
}: {
  lang: string
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <RootProvider
      i18n={{
        ...provider(lang),
        // The default handler swaps the first path segment, but the base
        // locale has no segment - localizePathname knows both spellings.
        onLocaleChange: (locale) =>
          router.push(localizePathname(pathname, locale, i18nConfig)),
      }}
      search={{ enabled: false }}
    >
      {children}
    </RootProvider>
  )
}
