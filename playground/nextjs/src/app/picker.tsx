'use client'

import { compress } from 'image-budget'
import { useState } from 'react'
import type { Result } from 'image-budget'

export function Picker() {
  const [result, setResult] = useState<Result | null>(null)

  return (
    <>
      <input
        type='file'
        accept='image/*,.heic,.heif'
        onChange={async (event) => {
          const file = event.target.files?.[0]
          if (!file) return
          setResult(await compress(file, { maxBytes: 150 * 1024 }))
        }}
      />

      {result && (
        <pre>
          {JSON.stringify(
            {
              bytes: result.bytes,
              format: result.format,
              size: [result.width, result.height],
              attempts: result.attempts,
              degraded: result.degraded,
            },
            null,
            2,
          )}
        </pre>
      )}
    </>
  )
}
