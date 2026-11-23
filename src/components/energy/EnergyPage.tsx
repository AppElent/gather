import { checkEnergySiteName, ENERGY_LIMITS } from '@gather/core/energy'
import {
  type EnergySourceState,
  energyHomeHasProblem,
  energyHomeSourceLine,
  energyHomeSources,
  formatEnergyDate,
  formatEnergyEuro,
} from '@gather/core/energy-present'
import { readEnergyRefusal } from '@gather/core/refusals'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { type FormEvent, useId, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useErrorMessage } from '../../lib/errorMessage'
import { fmt, useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { SurfaceCard } from '../app/ShellPrimitives'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { daySeries, dayTicks, hourSeries } from './energySeries'
import {
  ChartFigure,
  contractSummary,
  type EnergyPeriod,
  FIELD,
  MirrorBars,
  mirrorLegend,
  NavRow,
  PRIMARY,
  RowList,
  readingDate,
  SECONDARY,
  useEnergyToday,
} from './energyShared'

type SourceChoice = 'homeAssistant' | 'manual'

/**
 * The Energy Module (APP-492): the Group's address, or the way to add one.
 *
 * Empty, it says what the Module is for and offers one step: adding an address
 * (ADR-0022). The form asks a name, an optional House from Finances and how the
 * data comes in, as `designs/energy/Main.dc.html` draws it. Choosing meter
 * readings saves that source with the address; choosing
 * Home Assistant saves the address alone and goes on to connecting it
 * (APP-495).
 *
 * With an address (APP-494), the page names it and its source, invites the
 * first meter readings while nothing is measured, shows usage per hour (an
 * hourly source) or per day (typed readings) and links to Usage, Costs,
 * Meter readings, Contract and Sources. A source with a problem says so in
 * the summary's second line, with when its data is from (ADR-0020).
 */
export function EnergyPage() {
  const group = useRequiredCurrentGroup()
  const overview = useQuery(api.energy.overview, { groupSlug: group.slug })
  const { messages } = useI18n()

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <header>
        <div className="min-w-0">
          <h2 className="m-0 font-rounded text-2xl font-bold">
            {messages.modules.byId.energy.label}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {overview === undefined
              ? ' '
              : overview
                ? overview.site.name
                : messages.energy.empty.summary}
          </p>
        </div>
      </header>

      {overview === undefined ? (
        <div className="h-40 animate-pulse rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface-2)]" />
      ) : overview ? (
        <SiteHome overview={overview} groupSlug={group.slug} />
      ) : (
        <AddFirstAddress groupSlug={group.slug} />
      )}
    </div>
  )
}

/**
 * An address with its data (APP-494): the summary, the first step while
 * nothing is measured yet, the usage card and the rows to the pages below.
 */
function SiteHome({
  overview,
  groupSlug,
}: {
  overview: {
    site: { name: string }
    sources: EnergySourceState[]
  }
  groupSlug: string
}) {
  const { messages, locale } = useI18n()
  const copy = messages.energy
  const { today, month } = useEnergyToday()
  const form = useQuery(api.energyReadings.form, { groupSlug, day: today })
  const period = useQuery(api.energyUsage.month, { groupSlug, month, today })
  const hourly = period?.hasHourly === true
  const day = useQuery(
    api.energyUsage.day,
    hourly ? { groupSlug, day: today, today } : 'skip',
  )
  const typedChannels = form?.channels.length ?? 0

  const now = Date.now()
  const shown = energyHomeSources(overview.sources, typedChannels)
  const sourceLine =
    overview.sources.length === 0
      ? copy.site.sourceNone
      : shown
          .map((source) =>
            source.kind !== 'manual'
              ? energyHomeSourceLine(source, now, copy, locale)
              : form?.lastReadingAt
                ? fmt(copy.site.lastReading, {
                    source: source.label,
                    date: readingDate(form.lastReadingAt, locale),
                  })
                : fmt(copy.site.noReadingYet, { source: source.label }),
          )
          .join(' · ')
  const problem = energyHomeHasProblem(shown)
  const connected = shown.some((source) => source.kind !== 'manual')

  const monthCost = period?.totals.cost
  const contract = period?.contract

  return (
    <>
      <SurfaceCard className="grid gap-1">
        <h3 className="m-0 text-lg font-semibold">{overview.site.name}</h3>
        <p
          className={`m-0 text-sm ${problem ? 'font-semibold text-[var(--danger)]' : 'text-[var(--muted)]'}`}
        >
          {sourceLine}
        </p>
      </SurfaceCard>

      {overview.sources.length === 0 ? (
        <SurfaceCard className="grid gap-2">
          <h3 className="m-0 text-sm font-semibold">{copy.site.nextTitle}</h3>
          <p className="m-0 text-sm text-[var(--muted)]">
            {copy.site.nextHomeAssistant}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link {...linkTo('energyConnect')} className={PRIMARY}>
              {copy.site.nextConnect}
            </Link>
            <Link {...linkTo('energyReadings')} className={SECONDARY}>
              {copy.home.firstReadingAction}
            </Link>
          </div>
        </SurfaceCard>
      ) : form && period && typedChannels === 0 && !hourly && !connected ? (
        <SurfaceCard className="grid gap-2">
          <h3 className="m-0 text-lg font-semibold">
            {copy.home.firstReadingTitle}
          </h3>
          <p className="m-0 text-sm">{copy.home.firstReadingBody}</p>
          <div>
            <Link {...linkTo('energyReadings')} className={PRIMARY}>
              {copy.home.firstReadingAction}
            </Link>
          </div>
        </SurfaceCard>
      ) : null}

      {period ? (
        hourly ? (
          day ? (
            <HourCard period={day} />
          ) : null
        ) : (
          <DayCard period={period} />
        )
      ) : null}

      <RowList as="nav" label={copy.home.navLabel}>
        <NavRow
          link={linkTo('energyUsage')}
          label={copy.home.usage}
          sub={hourly ? copy.home.usageSubHourly : copy.home.usageSubDaily}
        />
        <NavRow
          link={linkTo('energyCosts')}
          label={copy.home.costs}
          sub={
            monthCost
              ? fmt(copy.home.costsSub, {
                  amount: formatEnergyEuro(monthCost.totalCents, locale),
                  month: formatEnergyDate(month, locale, 'month'),
                })
              : copy.home.costsSubNone
          }
        />
        <NavRow
          link={linkTo('energyReadings')}
          label={copy.home.readings}
          sub={
            form?.lastReadingAt
              ? fmt(copy.home.readingsSub, {
                  date: readingDate(form.lastReadingAt, locale),
                })
              : copy.home.readingsSubNone
          }
        />
        <NavRow
          link={linkTo('energyContract')}
          label={copy.home.contract}
          sub={
            contract
              ? contractSummary(contract, messages, locale)
              : copy.home.contractSubNone
          }
        />
        <NavRow
          link={linkTo('energySources')}
          label={copy.sources.title}
          sub={copy.sources.homeRowSub}
        />
      </RowList>
    </>
  )
}

/** Today's usage and solar per hour, for a site with an hourly source. */
function HourCard({ period }: { period: EnergyPeriod }) {
  const { messages, locale } = useI18n()
  const { now } = useEnergyToday()
  const showSolar = period.channels.solar
  const { slots, label } = hourSeries(period, now, messages, locale)
  return (
    <Link
      {...linkTo('energyUsage')}
      className="block text-[var(--ink)] no-underline"
    >
      <ChartFigure
        title={messages.energy.home.hourCard}
        aside={
          <span className="text-sm text-[var(--muted)]">
            {messages.energy.home.openUsage} ›
          </span>
        }
        label={label}
        sentence={label}
        legend={mirrorLegend(messages, showSolar)}
      >
        <MirrorBars
          slots={slots}
          upHeight={56}
          downHeight={52}
          showDown={showSolar}
          ticks={['00', '06', '12', '18', '24']}
        />
      </ChartFigure>
    </Link>
  )
}

/** The days of this month, estimated from meter readings. */
function DayCard({ period }: { period: EnergyPeriod }) {
  const { messages, locale } = useI18n()
  const { today } = useEnergyToday()
  const showSolar = period.channels.solar
  const { slots, label } = daySeries(period, today, messages, locale)
  return (
    <Link
      {...linkTo('energyUsage')}
      className="block text-[var(--ink)] no-underline"
    >
      <ChartFigure
        title={messages.energy.home.dayCard}
        aside={
          <span className="text-sm text-[var(--muted)]">
            {messages.energy.home.openUsage} ›
          </span>
        }
        label={label}
        sentence={
          period.totals.estimated
            ? `${label} ${messages.energy.usage.estimatedNote}`
            : label
        }
        legend={mirrorLegend(messages, showSolar)}
      >
        <MirrorBars
          slots={slots}
          upHeight={56}
          downHeight={52}
          showDown={showSolar}
          ticks={dayTicks(period.days.length)}
        />
      </ChartFigure>
    </Link>
  )
}

function AddFirstAddress({ groupSlug }: { groupSlug: string }) {
  const { messages } = useI18n()
  const copy = messages.energy
  const [adding, setAdding] = useState(false)

  if (!adding) {
    return (
      <SurfaceCard className="grid gap-3 py-8">
        <h3 className="m-0 text-lg font-semibold">{copy.empty.title}</h3>
        <p className="m-0 max-w-xl text-sm">{copy.empty.body}</p>
        <p className="m-0 max-w-xl text-sm text-[var(--muted)]">
          {copy.empty.next}
        </p>
        <div>
          <button
            type="button"
            className={PRIMARY}
            onClick={() => setAdding(true)}
          >
            {copy.empty.action}
          </button>
        </div>
      </SurfaceCard>
    )
  }
  return <AddressForm groupSlug={groupSlug} />
}

function AddressForm({ groupSlug }: { groupSlug: string }) {
  const { messages } = useI18n()
  const errorText = useErrorMessage()
  const copy = messages.energy
  const houses = useQuery(api.houses.list, { groupSlug })
  const createSite = useMutation(api.energy.createSite)
  const navigate = useNavigate()
  const [name, setName] = useState(copy.form.defaultName)
  const [houseId, setHouseId] = useState('')
  const [source, setSource] = useState<SourceChoice>('homeAssistant')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ids = useId()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const checked = checkEnergySiteName(name)
    if ('problem' in checked) {
      setError(copy.refusals[checked.problem])
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createSite({
        groupSlug,
        name: checked.name,
        houseId: houseId ? (houseId as Id<'houses'>) : undefined,
        source:
          source === 'manual'
            ? { kind: 'manual', label: copy.site.manualSourceLabel }
            : { kind: 'homeAssistant' },
      })
      if (source === 'homeAssistant') await navigate(linkTo('energyConnect'))
    } catch (caught) {
      const code = readEnergyRefusal(caught)
      setError(
        code
          ? copy.refusals[code]
          : errorText(caught, messages.common.errors.didNotWork),
      )
      setSaving(false)
    }
  }

  const options: { value: SourceChoice; label: string; hint: string }[] = [
    {
      value: 'homeAssistant',
      label: copy.form.homeAssistant,
      hint: copy.form.homeAssistantHint,
    },
    { value: 'manual', label: copy.form.manual, hint: copy.form.manualHint },
  ]

  return (
    <form className="grid gap-4" onSubmit={submit} noValidate>
      <SurfaceCard className="grid gap-3">
        <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {copy.form.addressHeading}
        </h3>
        <label className="grid gap-1 text-sm font-medium" htmlFor={`${ids}-name`}>
          {copy.form.name}
          <input
            id={`${ids}-name`}
            className={FIELD}
            value={name}
            maxLength={ENERGY_LIMITS.siteName}
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium" htmlFor={`${ids}-house`}>
          {copy.form.house}
          <select
            id={`${ids}-house`}
            className={FIELD}
            value={houseId}
            aria-describedby={`${ids}-house-hint`}
            onChange={(event) => setHouseId(event.target.value)}
          >
            <option value="">{copy.form.houseNone}</option>
            {(houses ?? []).map((house) => (
              <option key={house._id} value={house._id}>
                {house.name}
              </option>
            ))}
          </select>
        </label>
        <p
          id={`${ids}-house-hint`}
          className="m-0 text-xs text-[var(--muted)]"
        >
          {copy.form.houseHint}
        </p>
      </SurfaceCard>

      <SurfaceCard className="grid gap-3">
        <fieldset className="m-0 grid gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {copy.form.sourceHeading}
          </legend>
          {options.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-[var(--hair)] p-3 has-[:checked]:border-[var(--ink)]"
            >
              <input
                type="radio"
                name={`${ids}-source`}
                value={option.value}
                checked={source === option.value}
                onChange={() => setSource(option.value)}
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent-text)]"
              />
              <span className="grid gap-0.5">
                <span className="text-sm font-semibold">{option.label}</span>
                <span className="text-xs text-[var(--muted)]">
                  {option.hint}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      </SurfaceCard>

      {error ? (
        <p role="alert" className="m-0 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <div>
        <button type="submit" className={PRIMARY} disabled={saving}>
          {saving ? copy.form.saving : copy.form.submit}
        </button>
      </div>
    </form>
  )
}
