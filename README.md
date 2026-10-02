# image-budget

Compress an image to a byte budget in the browser - and find out what actually
happened.

Docs and a live playground: <https://image-budget.aiwan.run>

```text
packages/image-budget   the package
  src/core/             the strategy: byte-budget search, format planning, verification
  src/engines/          canvas (native) and jSquash (opt-in subpath)
  src/decode/           native decode, plus the HEIC branch
  src/worker/           the same pipeline, off the main thread
apps/website            bilingual docs + a playground that runs in the page
playground/nextjs       App Router, server page + client picker
playground/vite         the same thing as a plain SPA, through a worker
```

## Why

Every failure mode in this problem space is silent:

- `canvas.convertToBlob` returns **PNG** for a format it cannot encode, with no
  error
- EXIF disappears the moment pixels reach a canvas
- Safari renders a **blank** image past ~16.7M pixels instead of throwing
- HEIC from an iPhone often arrives with an empty mime type
- converting a transparent PNG to JPEG paints the background black

So this library never echoes your request back at you. `result.format` is read
off the blob, and `result.degraded` is empty only when the output is exactly
what was asked for. The library encodes; knowing what you got is the product.

```ts
import { compress } from 'image-budget'

const result = await compress(file, { maxBytes: 200 * 1024 })

if (result.degraded.length > 0) console.warn(result.degraded)
await upload(result.blob)
```

## Design

One function at the seam, two internal seams behind it:

```text
compress(input, options) -> Result
  |
  +- decode      Decoder: native | heic-to (dynamic import, magic-byte sniff)
  +- probe       what this engine can really emit, by encoding 8x8 and reading back
  +- plan        pick a format; never flatten possible transparency
  +- seek        bisect quality, then shrink pixels; capped and reported
  +- verify      read blob.type; disagreement becomes a Degradation
```

`seek` takes the encoder as a parameter, so the search is tested against a fake
that returns blobs of a known size - no canvas, no codec, no fixtures.

Engines are single-shot on purpose: an engine encodes once at the quality it is
handed and has no opinion about budgets, because the search is the only layer
that can report honestly on itself.

## Off the main thread

Encoding is CPU-bound and synchronous inside the codec, so two images on the
main thread fight each other and the page. The pipeline only ever used
`createImageBitmap`, `OffscreenCanvas` and `Blob` - all present in a worker,
all transferable - so placement was never an interface decision:

```ts
import { createCompressor } from 'image-budget/worker'

const compressor = createCompressor()
const result = await compressor.compress(file, { maxBytes: 200 * 1024 })
```

`engine` and `signal` are the two options that cannot cross a postMessage
boundary; the types say so, and `signal` is relayed rather than dropped.
Turbopack will not build a `new Worker(new URL(...))` at all - see
[the workers page](https://image-budget.aiwan.run/docs/workers).

## Working on it

```bash
pnpm install
pnpm build          # the website and playgrounds consume the built package
pnpm test
pnpm typecheck
pnpm lint
```

```bash
pnpm dev:website    # localhost:3000, and /zh - includes the playground
pnpm dev:next
pnpm dev:vite
```

## License

MIT © [Brendan Dash](https://aiwan.run)
