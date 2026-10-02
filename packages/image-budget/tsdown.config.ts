import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'jsquash': 'src/jsquash.ts',
    'worker': 'src/worker.ts',
    // The worker half on its own, for a worker file the app owns.
    'serve': 'src/serve.ts',
    // The default worker's own module. `worker.mjs` points a
    // `new Worker(new URL(...))` at it, so it has to be an entry rather than
    // a shared chunk.
    'worker-entry': 'src/worker/entry.ts',
  },
  // The codecs and the HEIC decoder are optional peers, reached through
  // dynamic import. Bundling them would defeat the point of both.
  deps: {
    neverBundle: [/^@jsquash\//, 'heic-to'],
  },
  sourcemap: true,
  dts: { sourcemap: true },
})
