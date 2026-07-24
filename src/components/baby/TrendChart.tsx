import { useEffect, useRef, useState } from 'react'

interface TrendChartProps {
  points: { x: number; y: number }[]
  unit: string
  height?: number
}

/** Minimal hand-rolled SVG line chart — no charting dependency, just enough
 * for temperature/growth trend lines over time. */
export function TrendChart({ points, unit, height = 160 }: TrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // The viewBox width must track the *actual* rendered pixel width, not a
  // fixed desktop-sized number — an SVG's font-size/stroke-width are in
  // viewBox user units, so a fixed 600-wide viewBox squeezed into a ~320px
  // phone card scales everything (including the axis labels) down to
  // illegible sub-6px text. Matching viewBox width to real width keeps user
  // units == CSS pixels at any screen size.
  const [width, setWidth] = useState(320)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth(Math.max(200, Math.round(w)))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (points.length < 2) {
    return (
      <p className="m-0 text-sm text-[var(--app-muted)]">
        Log at least two entries to see a trend line.
      </p>
    )
  }

  const padding = { top: 12, right: 12, bottom: 24, left: 40 }
  const sorted = [...points].sort((a, b) => a.x - b.x)
  const xs = sorted.map((p) => p.x)
  const ys = sorted.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const yRange = maxY - minY || 1
  const xRange = maxX - minX || 1

  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  const toX = (x: number) => padding.left + ((x - minX) / xRange) * plotWidth
  const toY = (y: number) =>
    padding.top + plotHeight - ((y - minY) / yRange) * plotHeight

  const path = sorted
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'}${toX(p.x).toFixed(1)},${toY(p.y).toFixed(1)}`,
    )
    .join(' ')

  return (
    <div ref={containerRef} className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`Trend chart, ${unit}, ${sorted.length} points`}
      >
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
          stroke="var(--app-border)"
        />
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke="var(--app-border)"
        />
        <text x={4} y={toY(maxY) + 4} fontSize="10" fill="var(--app-muted)">
          {maxY.toFixed(1)}
        </text>
        <text x={4} y={toY(minY) + 4} fontSize="10" fill="var(--app-muted)">
          {minY.toFixed(1)}
        </text>
        <path d={path} fill="none" stroke="var(--app-accent)" strokeWidth={2} />
        {sorted.map((p) => (
          <circle
            key={p.x}
            cx={toX(p.x)}
            cy={toY(p.y)}
            r={2.5}
            fill="var(--app-accent)"
          />
        ))}
        <text
          x={width - padding.right}
          y={height - 6}
          fontSize="10"
          textAnchor="end"
          fill="var(--app-muted)"
        >
          {new Date(maxX).toLocaleDateString()}
        </text>
        <text
          x={padding.left}
          y={height - 6}
          fontSize="10"
          fill="var(--app-muted)"
        >
          {new Date(minX).toLocaleDateString()}
        </text>
      </svg>
    </div>
  )
}
