import {
  type EnergyPriceBuildUp,
  type EnergyPriceView,
  energyNegativeCards,
  energyPriceBasisNote,
  energyPriceBuildUp,
  energyPriceCaption,
  energyPriceChart,
  energyPriceSourceName,
  energyPriceStateLine,
  energyTomorrowLine,
  formatEnergyPrice,
} from '@gather/core/energy-present'
import { useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { fmt, useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { Breadcrumbs } from '../app/Breadcrumbs'
import { SurfaceCard } from '../app/ShellPrimitives'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { PriceBars } from './energyPriceCards'
import {
  ChartFigure,
  energyTrail,
  Facts,
  NavRow,
  RowList,
  Segmented,
  useEnergyMinute,
} from './energyShared'

/**
 * Prices per hour, today and tomorrow (APP-493, design section 3): the hours,
 * the cheapest three, what makes up the price, and where it comes from.
 */
export function EnergyPricesPage() {
  const group = useRequiredCurrentGroup()
  const { messages } = useI18n()
  const copy = messages.energy.prices
  const { today, now } = useEnergyMinute()
  const view = useQuery(api.energyPrices.view, {
    groupSlug: group.slug,
    day: today,
  })

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <Breadcrumbs trail={energyTrail(messages, copy.title)} className="mb-0" />
      {view === undefined ? (
        <>
          <h2 className="m-0 font-rounded text-2xl font-bold">{copy.title}</h2>
          <div className="h-40 animate-pulse rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface-2)]" />
        </>
      ) : view === null ? (
        <>
          <h2 className="m-0 font-rounded text-2xl font-bold">{copy.title}</h2>
          <SurfaceCard>
            <p className="m-0 text-sm">{messages.energy.empty.summary}</p>
          </SurfaceCard>
        </>
      ) : (
        <Prices view={view} now={now} />
      )}
    </div>
  )
}

function Prices({ view, now }: { view: EnergyPriceView; now: number }) {
  const { messages, locale } = useI18n()
  const words = messages.energy
  const copy = words.prices
  const [tab, setTab] = useState<'today' | 'tomorrow'>('today')
  const prices = tab === 'today' ? view.today : view.tomorrow
  const chart = prices
    ? energyPriceChart(prices, tab === 'today' ? now : null, words, locale)
    : null
  const todayChart = view.today
    ? energyPriceChart(view.today, now, words, locale)
    : null
  const current = todayChart?.current
  const state = energyPriceStateLine(view, now, words, locale)
  const note = prices ? energyPriceBasisNote(view, prices, words) : null
  const buildUp =
    view.today && current
      ? energyPriceBuildUp(view.today, current, words, locale)
      : null

  return (
    <>
      <div className="grid gap-1">
        <h2 className="m-0 font-rounded text-2xl font-bold">
          {current && view.today
            ? fmt(view.today.basis === 'allIn' ? copy.now : copy.nowMarket, {
                price: formatEnergyPrice(current.price, locale),
              })
            : copy.nowNone}
        </h2>
        <p className="m-0 text-sm text-[var(--muted)]">
          {fmt(copy.source, {
            site: view.siteName,
            source: energyPriceSourceName(view, words),
          })}
        </p>
      </div>
      <Segmented
        label={copy.tabs}
        options={[
          { value: 'today', label: copy.today },
          { value: 'tomorrow', label: copy.tomorrow },
        ]}
        value={tab}
        onChange={setTab}
      />

      {prices && chart ? (
        <>
          <ChartFigure
            title={energyPriceCaption(prices, words, locale)}
            label={chart.sentence}
            sentence={chart.sentence}
            legend={chart.legend}
          >
            <PriceBars bars={chart.bars} height={150} highlight />
          </ChartFigure>
          {note ? (
            <p className="m-0 px-1 text-sm text-[var(--muted)]">{note}</p>
          ) : null}
          <Facts facts={chart.facts} />
          {energyNegativeCards(prices, words, locale).map((card) => (
            <SurfaceCard key={card.key} className="grid gap-1">
              <p className="m-0 text-sm font-semibold">{card.title}</p>
              <p className="m-0 text-sm">{card.body}</p>
            </SurfaceCard>
          ))}
        </>
      ) : (
        <SurfaceCard className="grid gap-1">
          <p className="m-0 text-base font-semibold">
            {tab === 'today' ? copy.todayNone : energyTomorrowLine(now, words)}
          </p>
          {state.problem ? (
            <p className="m-0 text-sm text-[var(--danger)]">{state.text}</p>
          ) : null}
        </SurfaceCard>
      )}

      {tab === 'today' ? (
        buildUp ? (
          <BuildUp buildUp={buildUp} />
        ) : view.today && view.today.basis === 'allIn' && !view.today.terms ? (
          <p className="m-0 px-1 text-sm text-[var(--muted)]">
            {fmt(copy.accountNote, {
              provider: energyPriceSourceName(view, words),
            })}
          </p>
        ) : null
      ) : null}

      <RowList>
        <NavRow
          link={linkTo('energyPriceFeed')}
          label={copy.sourceRow}
          sub={state.text}
          danger={state.problem}
        />
      </RowList>
    </>
  )
}

const PART_COLOUR = {
  market: 'bg-[var(--ink)]',
  markup: 'bg-[var(--muted)]',
  tax: 'bg-[var(--hair-strong)]',
  vat: 'bg-[var(--surface-2)] border border-[var(--hair)]',
} as const

/** The four parts of the price now, as one bar and as rows. */
function BuildUp({ buildUp }: { buildUp: EnergyPriceBuildUp }) {
  return (
    <figure aria-label={`${buildUp.title}. ${buildUp.label}`} className="shell-card m-0 grid gap-3">
      <h3 className="m-0 text-base font-semibold">{buildUp.title}</h3>
      <div
        aria-hidden="true"
        className="flex h-3.5 gap-0.5 overflow-hidden rounded-full"
      >
        {buildUp.parts.map((part) =>
          part.share > 0 ? (
            <span
              key={part.key}
              className={`box-border ${PART_COLOUR[part.key]}`}
              style={{ width: `${part.share * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <dl className="m-0 grid gap-1.5">
        {buildUp.parts.map((part) => (
          <div key={part.key} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className={`box-border h-2.5 w-2.5 shrink-0 rounded-[3px] ${PART_COLOUR[part.key]}`}
            />
            <dt className="min-w-0 flex-1">{part.label}</dt>
            <dd className="m-0 font-semibold tabular-nums">{part.value}</dd>
          </div>
        ))}
      </dl>
    </figure>
  )
}
