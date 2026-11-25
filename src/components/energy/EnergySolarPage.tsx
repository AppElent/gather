import {
  type EnergySolarTotals,
  energyPayback,
  energySolarTotals,
} from '@gather/core/energy'
import {
  energyAssetSpec,
  energyAssetsLine,
  energyAssetTotal,
  energyBatteryCard,
  energyPaybackText,
  energySelfSufficiencyChart,
  energySocNow,
  energySolarCard,
  energySolarHourChart,
  energyStoredLine,
} from '@gather/core/energy-present'
import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { Breadcrumbs } from '../app/Breadcrumbs'
import { SurfaceCard } from '../app/ShellPrimitives'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { EnergyAssetForm } from './EnergyAssetForm'
import { dayTicks, HOUR_TICKS } from './energySeries'
import {
  ChartFigure,
  type EnergyPeriod,
  energyTrail,
  monthTitle,
  NUMERAL,
  PRIMARY,
  RowList,
  SECONDARY,
  Segmented,
  useEnergyMinute,
} from './energyShared'
import {
  ChargeChart,
  type EnergyAssetRow,
  type EnergySolarMonth,
  SocBar,
  SolarBars,
  useEnergyPaybackDays,
} from './energySolarCharts'

type Range = 'today' | 'month'

/**
 * Solar and battery (APP-496, design §7): what the roof made and the home used
 * of it, what the battery earned, and what each asset has paid back.
 *
 * Only a source with hours can tell. A site with typed readings says why
 * instead of showing zeros, and can still keep its panels and battery here.
 */
export function EnergySolarPage() {
  const group = useRequiredCurrentGroup()
  const { messages, locale } = useI18n()
  const copy = messages.energy.solar
  const { today, month, now } = useEnergyMinute()
  const [range, setRange] = useState<Range>('today')
  const [editing, setEditing] = useState<EnergyAssetRow | 'new' | null>(null)
  const data = useQuery(api.energySolar.month, {
    groupSlug: group.slug,
    month,
    today,
  })
  const assets = data?.assets ?? []
  const line = energyAssetsLine(
    assets.map((each) => each.asset),
    messages.energy,
    locale,
  )

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <Breadcrumbs trail={energyTrail(messages, copy.title)} className="mb-0" />
      <header className="grid gap-0.5">
        <h1 className="m-0 font-rounded text-2xl font-bold">{copy.title}</h1>
        {data ? (
          <p className="m-0 text-sm text-[var(--muted)]">
            {[data.siteName, line].filter(Boolean).join(' · ')}
          </p>
        ) : null}
      </header>
      {data === undefined ? (
        <div className="h-40 animate-pulse rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface-2)]" />
      ) : data === null ? (
        <p className="m-0 text-sm">{messages.energy.empty.summary}</p>
      ) : (
        <>
          {data.status === 'ok' ? (
            <>
              <Segmented
                label={copy.rangeLabel}
                value={range}
                onChange={setRange}
                options={[
                  { value: 'today', label: copy.today },
                  { value: 'month', label: monthTitle(month, locale) },
                ]}
              />
              <Figures
                groupSlug={group.slug}
                data={data}
                range={range}
                month={month}
                today={today}
                now={now}
              />
            </>
          ) : (
            <SurfaceCard className="grid gap-2">
              <h2 className="m-0 text-lg font-semibold">
                {data.status === 'noHourly'
                  ? copy.noHourlyTitle
                  : copy.noAssetsTitle}
              </h2>
              <p className="m-0 text-sm">
                {data.status === 'noHourly'
                  ? copy.noHourlyBody
                  : copy.noAssetsBody}
              </p>
              <div>
                <Link
                  {...linkTo(
                    data.status === 'noHourly' ? 'energyConnect' : 'energySources',
                  )}
                  className={SECONDARY}
                >
                  {data.status === 'noHourly'
                    ? messages.energy.site.nextConnect
                    : copy.openSources}
                </Link>
              </div>
            </SurfaceCard>
          )}
          {editing ? (
            <EnergyAssetForm
              key={editing === 'new' ? 'new' : editing._id}
              groupSlug={group.slug}
              row={editing === 'new' ? null : editing}
              today={today}
              onDone={() => setEditing(null)}
            />
          ) : (
            <>
              {assets.length > 0 ? (
                <Assets
                  groupSlug={group.slug}
                  data={data}
                  today={today}
                  onEdit={setEditing}
                />
              ) : null}
              <div>
                <button
                  type="button"
                  className={data.status === 'ok' ? PRIMARY : SECONDARY}
                  onClick={() => setEditing('new')}
                >
                  {copy.add}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function Figures({
  groupSlug,
  data,
  range,
  month,
  today,
  now,
}: {
  groupSlug: string
  data: EnergySolarMonth
  range: Range
  month: string
  today: string
  now: number
}) {
  const { messages } = useI18n()
  const copy = messages.energy.solar
  const period = useQuery(api.energyUsage.day, {
    groupSlug,
    day: today,
    today,
  })
  const days =
    range === 'today'
      ? data.days.filter((each) => each.day === today)
      : data.days
  const totals = energySolarTotals(days)
  if (totals.producedKwh === null && totals.battery === null) {
    return (
      <p className="m-0 text-sm text-[var(--muted)]">
        {range === 'today' ? copy.nothingToday : copy.nothingMonth}
      </p>
    )
  }
  return (
    <>
      <SunCard
        data={data}
        totals={totals}
        range={range}
        month={month}
        today={today}
        period={period ?? null}
        now={now}
      />
      <BatteryCard
        data={data}
        totals={totals}
        period={range === 'today' ? (period ?? null) : null}
      />
      {range === 'today' && data.batterySoc && period ? (
        <ChargeChart period={period} isToday now={now} />
      ) : null}
    </>
  )
}

function SunCard({
  data,
  totals,
  range,
  month,
  today,
  period,
  now,
}: {
  data: EnergySolarMonth
  totals: EnergySolarTotals
  range: Range
  month: string
  today: string
  period: EnergyPeriod | null
  now: number
}) {
  const { messages, locale } = useI18n()
  const copy = messages.energy.solar
  const card = energySolarCard(
    totals,
    range,
    data.battery,
    messages.energy,
    locale,
  )
  if (!card) return null
  const hours =
    range === 'today' && period
      ? energySolarHourChart(period.hours, now, messages.energy, locale)
      : null
  const perDay =
    range === 'month'
      ? energySelfSufficiencyChart(
          data.days,
          month,
          today,
          messages.energy,
          locale,
        )
      : null
  return (
    <>
      <section aria-labelledby="solar-sun" className="shell-card grid gap-3">
        <h2 id="solar-sun" className="m-0 text-base font-semibold">
          {copy.sun}
        </h2>
        <dl className="m-0 flex flex-wrap gap-x-6 gap-y-2">
          {card.facts.map((fact) => (
            <div key={fact.key} className="grid min-w-0 flex-1 basis-24">
              <dt className="text-sm text-[var(--muted)]">{fact.label}</dt>
              <dd className="m-0 text-xl font-bold tabular-nums">
                {fact.value}{' '}
                <span className="text-sm font-normal text-[var(--muted)]">
                  {fact.unit}
                </span>
              </dd>
            </div>
          ))}
        </dl>
        {card.selfShare !== null ? (
          <div
            role="img"
            aria-label={card.barLabel ?? undefined}
            className="flex h-3.5 gap-0.5 overflow-hidden rounded-full"
          >
            <span
              className="bg-[var(--ink)]"
              style={{ width: `${card.selfShare * 100}%` }}
            />
            <span className="min-w-0 flex-1 bg-[var(--muted)]" />
          </div>
        ) : null}
        <p className="m-0 text-sm">{card.sentence ?? copy.noExport}</p>
      </section>
      {hours ? (
        <ChartFigure
          title={copy.perHour}
          aside={<Unit text={messages.energy.units.kWh} />}
          label={hours.sentence}
          sentence={hours.sentence}
        >
          <SolarBars bars={hours.bars} height={72} ticks={HOUR_TICKS} />
        </ChartFigure>
      ) : null}
      {perDay ? (
        <ChartFigure
          title={copy.perDay}
          aside={<Unit text={messages.energy.units.percent} />}
          label={perDay.sentence}
          sentence={perDay.sentence}
        >
          <SolarBars
            bars={perDay.bars}
            height={80}
            ticks={dayTicks(perDay.bars.length)}
            average={perDay.average}
          />
        </ChartFigure>
      ) : null}
    </>
  )
}

function Unit({ text }: { text: string }) {
  return <span className="text-xs text-[var(--muted)]">{text}</span>
}

function BatteryCard({
  data,
  totals,
  period,
}: {
  data: EnergySolarMonth
  totals: EnergySolarTotals
  period: EnergyPeriod | null
}) {
  const { messages, locale } = useI18n()
  const copy = messages.energy.solar
  const card = energyBatteryCard(totals, messages.energy, locale)
  if (!card) return null
  const percent = period ? energySocNow(period.hours) : null
  const stored = energyStoredLine(
    percent,
    energyAssetTotal(
      data.assets.map((each) => each.asset),
      'battery',
    ),
    messages.energy,
    locale,
  )
  return (
    <section aria-labelledby="solar-battery" className="shell-card grid gap-3">
      <h2 id="solar-battery" className="m-0 text-base font-semibold">
        {copy.battery}
      </h2>
      {percent !== null ? (
        <div className="grid gap-2">
          <p className="m-0 flex flex-wrap items-baseline justify-between gap-2">
            <span className={NUMERAL}>{Math.round(percent)}%</span>
            {stored ? (
              <span className="text-sm text-[var(--muted)] tabular-nums">
                {stored}
              </span>
            ) : null}
          </p>
          <SocBar percent={percent} />
        </div>
      ) : null}
      <dl className="m-0 grid divide-y divide-[var(--hair)]">
        {card.rows.map((row) => (
          <div
            key={row.key}
            className={`flex flex-wrap items-baseline justify-between gap-x-3 py-2 ${row.strong ? 'font-bold' : ''}`}
          >
            <dt>{row.label}</dt>
            <dd className="m-0 tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
      {card.note ? <p className="m-0 text-sm">{card.note}</p> : null}
      {card.footnote ? (
        <p className="m-0 text-sm text-[var(--muted)]">{card.footnote}</p>
      ) : null}
    </section>
  )
}

function Assets({
  groupSlug,
  data,
  today,
  onEdit,
}: {
  groupSlug: string
  data: EnergySolarMonth
  today: string
  onEdit: (row: EnergyAssetRow) => void
}) {
  const { messages, locale } = useI18n()
  const copy = messages.energy.solar
  const payback = useEnergyPaybackDays(groupSlug, data, today)
  const all = data.assets.map((each) => each.asset)
  const anyPrice = all.some((asset) => asset.purchaseCents !== undefined)
  const days = (payback?.days ?? []).map((day) => ({
    day: day.day,
    solarEur: day.solarEur,
    batteryEur: day.batteryEur,
    solarMeasured: day.selfUsedKwh !== null,
    batteryMeasured: day.battery !== null,
  }))
  return (
    <section aria-labelledby="solar-assets" className="grid gap-2">
      <h2 id="solar-assets" className="m-0 text-base font-semibold">
        {anyPrice && data.status === 'ok' ? copy.payback : copy.assets}
      </h2>
      <RowList>
        {data.assets.map((row, index) => {
          const asset = all[index] ?? row.asset
          const text =
            data.status === 'ok' && payback
              ? energyPaybackText(
                  asset,
                  energyPayback(asset, all, days),
                  messages.energy,
                  locale,
                )
              : null
          return (
            <button
              key={row._id}
              type="button"
              onClick={() => onEdit(row)}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left text-[var(--ink)] hover:bg-[var(--surface-2)]"
            >
              <span className="grid min-w-0 flex-1 gap-1.5">
                <span className="grid">
                  <span className="text-base [overflow-wrap:anywhere]">
                    {asset.name}
                  </span>
                  <span className="text-sm text-[var(--muted)]">
                    {energyAssetSpec(asset, messages.energy, locale)}
                  </span>
                </span>
                {text ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="block h-2 overflow-hidden rounded-full bg-[var(--surface-2)]"
                    >
                      <span
                        className="block h-full rounded-full bg-[var(--ink)]"
                        style={{ width: `${text.share * 100}%` }}
                      />
                    </span>
                    <span className="text-sm tabular-nums">
                      {text.amount ? <b>{text.amount} </b> : null}
                      {text.rest}
                    </span>
                    {text.notes.map((note) => (
                      <span key={note} className="text-sm text-[var(--muted)]">
                        {note}
                      </span>
                    ))}
                  </>
                ) : null}
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-[var(--muted)]"
                aria-hidden="true"
              />
            </button>
          )
        })}
      </RowList>
      {payback?.partial ? (
        <p className="m-0 text-sm text-[var(--muted)]">{copy.paybackPartial}</p>
      ) : null}
      {!anyPrice && data.status === 'ok' ? (
        <p className="m-0 text-sm text-[var(--muted)]">{copy.paybackHint}</p>
      ) : null}
    </section>
  )
}
