import { serve } from './serve.ts'

// The default worker: native canvas only, and therefore no WASM anywhere in
// its module graph. See `entry-jsquash.ts` for the AVIF-capable one.
serve()
