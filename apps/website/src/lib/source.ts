// The .source folder is generated when running `next dev` / `next build`.
import { loader } from 'fumadocs-core/source'
import { docs } from '../../.source/server'
import { i18n } from './i18n'

// See https://fumadocs.dev/docs/headless/source-api
export const source = loader({
  baseUrl: '/docs',
  i18n,
  source: docs.toFumadocsSource(),
})
