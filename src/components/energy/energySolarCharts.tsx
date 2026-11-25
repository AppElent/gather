import {
  type EnergyAssetTerms,
  energyMonthToday,
  energyPaybackMonths,
} from '@gather/core/energy'
import {
  type EnergySolarBar,
  energyBatteryStrip,
  energySocNow,
  formatEnergyDate,
} from '@gather/core/energy-present'
import { useQueries } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useMemo } from 'react'
import { api } from '../../../convex/_generated/api'
import { fmt, useI18n } from '../../lib/i18n'
import { HOUR_TICKS } from './energySeries'
import { ChartFigure, type EnergyPeriod, FUTURE_BAR } from './energyShared'

/**
 * The solar and battery chart shapes (APP-496, `designs/energy/README.md`
 * §1.4 and §11), and the months a payback adds up.
 */

export type EnergySolarMonth = NonNullable<
  FunctionReturnType<typeof api.energySolar.month>
>
export type EnergyAssetRow = {
  _id: EnergySolarMonth['assets'][number]['_id']
  asset: EnergyAssetTerms
}

const STRIP = {
  charging: 'bg-[var(--ink)]',
  discharging: 'bg-[var(--home-text)]',
  idle: 'bg-[var(--surface-2)]',
  future: FUTURE_BAR,
  unknown: '',
}

/**
 * The battery's state of charge through a day, a line over a light area, with
 * what the battery did each hour on a strip under it.
 */
export function ChargeChart({
  period,
  isToday,
  now,
}: {
  period: EnergyPeriod
  isToday: boolean
  now: number
}) {
  const { messages, locale } = useI18n()
  const copy = messages.energy.usage
  const solar = messages.energy.solar
  const count = Math.max(1, period.hours.length)
  // A point sits in the middle of its hour, over its own cell of the strip.
  const points = period.hours
    .map((hour, index) =>
      hour.socPercent === null
        ? null
        : {
            x: ((index + 0.5) / count) * 240,
            y: 100 - Math.min(100, Math.max(0, hour.socPercent)),
            percent: hour.socPercent,
          },
    )
    .filter((point) => point !== null)
  const strip = energyBatteryStrip(period.hours, now, messages.energy, locale)
  if (points.length === 0 && !strip) return null
  const values = points.map((point) => point.percent)
  const last = points[points.length - 1]
  const first = points[0]
  const line = points.map((point) => `${point.x},${point.y}`).join(' ')
  const date = formatEnergyDate(period.days[0]?.day ?? '', locale, 'dayMonth')
  const percent = energySocNow(period.hours)
  const label = [
    points.length
      ? fmt(copy.socLabel, {
          date,
          low: Math.round(Math.min(...values)),
          high: Math.round(Math.max(...values)),
        })
      : null,
    strip?.sentence,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <ChartFigure
      title={points.length ? copy.socTitle : solar.battery}
      aside={
        isToday && percent !== null ? (
          <span className="text-xs text-[var(--muted)] tabular-nums">
            {fmt(copy.socNow, { percent: Math.round(percent) })}
          </span>
        ) : null
      }
      label={label}
      sentence={label}
      legend={
        strip
          ? [
              { label: copy.socCharge, swatch: 'ink' },
              { label: copy.socDischarge, swatch: 'solar' },
              { label: solar.legendIdle, swatch: 'idle' },
              ...(strip.cells.some((cell) => cell.mode === 'future')
                ? [{ label: copy.legendFuture, swatch: 'future' as const }]
                : []),
            ]
          : undefined
      }
    >
      <div aria-hidden="true" className="flex gap-2">
        {first ? (
          <div className="flex h-[100px] w-7 shrink-0 flex-col justify-between text-right text-xs leading-none text-[var(--muted)] tabular-nums">
            <span>100</span>
            <span>50</span>
            <span>0</span>
          </div>
        ) : null}
        <div className="grid min-w-0 flex-1 gap-1">
          {first && last ? (
            <svg
              viewBox="0 0 240 100"
              preserveAspectRatio="none"
              className="block h-[100px] w-full"
            >
              <line x1="0" y1="1" x2="240" y2="1" stroke="var(--hair)" vectorEffect="non-scaling-stroke" />
              <line x1="0" y1="50" x2="240" y2="50" stroke="var(--hair)" vectorEffect="non-scaling-stroke" />
              <line x1="0" y1="99" x2="240" y2="99" stroke="var(--muted)" vectorEffect="non-scaling-stroke" />
              <polygon
                points={`${first.x},100 ${line} ${last.x},100`}
                fill="var(--home-wash)"
              />
              <polyline
                points={line}
                fill="none"
                stroke="var(--ink)"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          ) : null}
          {strip ? (
            <div className="flex gap-0.5">
              {strip.cells.map((cell) => (
                <span
                  key={cell.key}
                  data-mode={cell.mode}
                  className={`box-border h-2 min-w-0 flex-1 rounded-[2px] ${STRIP[cell.mode]}`}
                />
              ))}
            </div>
          ) : null}
          <div className="flex justify-between text-xs text-[var(--muted)] tabular-nums">
            {HOUR_TICKS.map((tick) => (
              <span key={tick}>{tick}</span>
            ))}
          </div>
        </div>
      </div>
    </ChartFigure>
  )
}

/** How full the battery is. The words beside it say it, so it is decoration. */
export function SocBar({ percent }: { percent: number }) {
  return (
    <div
      aria-hidden="true"
      className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)]"
    >
      <div
        className="h-full rounded-full bg-[var(--ink)]"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

/** Bars in ink on one scale, with an average as a dashed line when given. */
export function SolarBars({
  bars,
  height,
  ticks,
  average,
}: {
  bars: readonly EnergySolarBar[]
  height: number
  ticks: readonly string[]
  average?: number
}) {
  const top = Math.max(average ?? 0, ...bars.map((bar) => bar.height), 0)
  const scale = (value: number) =>
    top > 0 ? Math.round((value / top) * height) : 0
  return (
    <div aria-hidden="true" className="grid">
      <div
        className={`relative flex items-end ${bars.length > 25 ? 'gap-[2px]' : 'gap-[3px]'}`}
        style={{ height }}
      >
        {bars.map((bar) => (
          <span
            key={bar.key}
            data-bar={bar.future ? 'future' : 'up'}
            className={`min-w-0 flex-1 rounded-t-[3px] ${bar.future ? FUTURE_BAR : 'bg-[var(--ink)]'}`}
            style={{ height: bar.future ? 4 : scale(bar.height) }}
          />
        ))}
        {average !== undefined ? (
          <span
            data-average=""
            className="absolute inset-x-0 border-t-[1.5px] border-dashed border-[var(--ink)] outline outline-1 outline-[var(--surface)]"
            style={{ bottom: scale(average) }}
          />
        ) : null}
      </div>
      <div className="h-px bg-[var(--hair)]" />
      <div className="mt-1 flex justify-between text-xs text-[var(--muted)] tabular-nums">
        {ticks.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
    </div>
  )
}

/**
 * Every day since the first figures, one query per month, so the server never
 * reads a year of hours in one go. `null` while a month is still loading.
 */
export function useEnergyPaybackDays(
  groupSlug: string,
  solar: EnergySolarMonth,
  today: string,
): { days: EnergySolarMonth['days']; partial: boolean } | null {
  const months = energyPaybackMonths(
    solar.assets.map((each) => each.asset),
    solar.firstDay,
    today,
  ).join(',')
  const queries = useMemo(() => {
    const entries: Record<
      string,
      { query: typeof api.energySolar.month; args: Record<string, string> }
    > = {}
    for (const month of months ? months.split(',') : []) {
      entries[month] = {
        query: api.energySolar.month,
        args: { groupSlug, month, today: energyMonthToday(month, today) },
      }
    }
    return entries
  }, [groupSlug, months, today])
  const results = Object.values(useQueries(queries))
  if (results.some((each) => each === undefined)) return null
  return {
    days: results.flatMap((each) =>
      each instanceof Error || !each ? [] : (each as EnergySolarMonth).days,
    ),
    partial: results.some((each) => each instanceof Error || each === null),
  }
}
