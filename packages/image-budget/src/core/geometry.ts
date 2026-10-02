/**
 * Scale to fit both a longest-edge cap and a total-pixel cap, never scaling up.
 *
 * The pixel cap is the iOS canvas ceiling: Safari returns a blank canvas past
 * roughly 16.7M pixels rather than throwing, so a dimension-only guard lets
 * 4096x8000 through and produces a silently empty image.
 */
export function fit(
  width: number,
  height: number,
  maxDimension = Number.POSITIVE_INFINITY,
  maxPixels = Number.POSITIVE_INFINITY,
): readonly [number, number] {
  const byEdge = Math.min(1, maxDimension / Math.max(width, height))
  const byArea = Math.min(1, Math.sqrt(maxPixels / (width * height)))
  const scale = Math.min(byEdge, byArea)

  if (scale >= 1) return [width, height]

  // At least 1px on each side - a zero-width canvas throws.
  return [
    Math.max(1, Math.floor(width * scale)),
    Math.max(1, Math.floor(height * scale)),
  ]
}
