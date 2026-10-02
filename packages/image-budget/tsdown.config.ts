import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    jsquash: 'src/jsquash.ts',
  },
  // The codecs and the HEIC decoder are optional peers, reached through
  // dynamic import. Bundling them would defeat the point of both.
  deps: {
    neverBundle: [/^@jsquash\//, 'heic-to'],
  },
  sourcemap: true,
  dts: { sourcemap: true },
})
