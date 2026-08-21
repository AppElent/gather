/**
 * Turning logged events into a polyline.
 *
 * Pure, and separated from the drawing for the usual reason: a chart component
 * cannot be asked what it would draw, and this can. The scaling in particular
 * is worth a test — a single point, or several points that all share one value,
 * are the two cases that produce a divide-by-zero and a flat line through the
 * top of the box.
 */
import type { BabyEventType } from '@gather/core/domain'

export interface TrendSource {
  type: BabyEventType
  timestamp: number
  data: unknown
}

export interface TrendPoint {
  x: number
  y: number
}

/** `{x, y}` in chart pixels, ready for a `<Polyline>`. */
export interface PlottedTrend {
  points: TrendPoint[]
  min: number
  max: number
  latest: number
}

/** The measurements of one kind, oldest first. */
export function trendValues(
  events: readonly TrendSource[],
  type: BabyEventType,
  field: string,
): { at: number; value: number }[] {
  return events
    .filter((event) => event.type === type)
    .map((event) => ({
      at: event.timestamp,
      value: (event.data as Record<string, unknown> | null)?.[field],
    }))
    .filter(
      (point): point is { at: number; value: number } =>
        typeof point.value === 'number' && Number.isFinite(point.value),
    )
    .sort((a, b) => a.at - b.at)
}

/**
 * Scales values into a box.
 *
 * Fewer than two points draws nothing: one measurement is not a trend, and a
 * line through a single point is a claim the data does not support. When every
 * value is identical the line sits in the middle of the box rather than at its
 * top, which is what a zero range would otherwise produce.
 */
export function plotTrend(
  values: readonly { at: number; value: number }[],
  width: number,
  height: number,
): PlottedTrend | null {
  if (values.length < 2) return null

  const ys = values.map((v) => v.value)
  const min = Math.min(...ys)
  const max = Math.max(...ys)
  const range = max - min
  const first = values[0].at
  const span = values[values.length - 1].at - first

  const points = values.map((value, index) => ({
    x:
      span === 0
        ? (width / (values.length - 1)) * index
        : ((value.at - first) / span) * width,
    y:
      range === 0
        ? height / 2
        : height - ((value.value - min) / range) * height,
  }))

  return { points, min, max, latest: ys[ys.length - 1] }
}

/** The `points` attribute `<Polyline>` wants. */
export function toPolyline(points: readonly TrendPoint[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}
