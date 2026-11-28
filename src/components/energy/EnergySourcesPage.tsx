import {
  energyChannelRows,
  energyManualLine,
  energySourceLine,
  energyStaleStatistics,
} from '@gather/core/energy-present'
import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import type { ReactNode } from 'react'
import { api } from '../../../convex/_generated/api'
import { fmt, plural, useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { Breadcrumbs } from '../app/Breadcrumbs'
import { SurfaceCard } from '../app/ShellPrimitives'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { energyTrail, NavRow, RowList, ValueRow } from './energyShared'

type SourceList = NonNullable<FunctionReturnType<typeof api.energySources.list>>

/**
 * What feeds the address (APP-495, design section 8): each source with its
 * state in words, each channel with the one source it comes from, and the
 * sources to add.
 */
export function EnergySourcesPage() {
  const group = useRequiredCurrentGroup()
  const { messages } = useI18n()
  const copy = messages.energy.sources
  const list = useQuery(api.energySources.list, { groupSlug: group.slug })

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <Breadcrumbs trail={energyTrail(messages, copy.title)} className="mb-0" />
      {list === undefined ? (
        <>
          <h1 className="m-0 font-rounded text-2xl font-bold">{copy.title}</h1>
          <div className="h-40 animate-pulse rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface-2)]" />
        </>
      ) : list === null ? (
        <>
          <h1 className="m-0 font-rounded text-2xl font-bold">{copy.title}</h1>
          <SurfaceCard>
            <p className="m-0 text-sm">{messages.energy.empty.summary}</p>
          </SurfaceCard>
        </>
      ) : (
        <Sources list={list} />
      )}
    </div>
  )
}

function Sources({ list }: { list: SourceList }) {
  const { messages, locale } = useI18n()
  const words = messages.energy
  const copy = words.sources
  const now = Date.now()
  const label = new Map<string, string>(list.sources.map((each) => [each._id, each.label]))
  const rows = energyChannelRows(
    list.channels,
    words,
    list.sources.flatMap(energyStaleStatistics),
  )
  const homeAssistant = list.sources.some(
    (each) => each.kind === 'homeAssistant',
  )
  const enelogic = list.sources.some((each) => each.kind === 'enelogic')

  return (
    <>
      <div className="grid gap-1">
        <h1 className="m-0 font-rounded text-2xl font-bold">{copy.title}</h1>
        <p className="m-0 text-sm text-[var(--muted)]">
          {fmt(copy.summary, {
            sources: plural(locale, list.sources.length, copy.countSources),
            channels: plural(locale, list.channels.length, copy.countChannels),
          })}
        </p>
      </div>

      <Section title={copy.heading}>
        {list.sources.length === 0 ? (
          <p className="m-0 text-sm text-[var(--muted)]">{copy.none}</p>
        ) : (
          <RowList>
            {list.sources.map((source) => {
              const line =
                source.kind === 'manual'
                  ? energyManualLine(source.readings, now, words, locale)
                  : energySourceLine(source, now, words, locale)
              return (
                <SourceRow
                  key={source._id}
                  label={source.label}
                  line={line.text}
                  problem={line.problem}
                  link={
                    source.kind === 'manual'
                      ? linkTo('energyReadings')
                      : !list.canManage
                        ? null
                        : source.kind === 'enelogic'
                          ? linkTo('energyEnelogic')
                          : linkTo('energyConnect')
                  }
                />
              )
            })}
          </RowList>
        )}
      </Section>

      <Section title={copy.channelsHeading}>
        {rows.length === 0 ? (
          <p className="m-0 text-sm text-[var(--muted)]">{copy.channelsNone}</p>
        ) : (
          <RowList>
            {rows.map((row) => (
              <ValueRow
                key={row.key}
                label={row.name}
                sub={row.stale ? copy.channelStale : undefined}
                danger={row.stale}
                value={label.get(row.sourceId) ?? ''}
              />
            ))}
          </RowList>
        )}
        <p className="m-0 text-sm text-[var(--muted)]">{copy.channelsNote}</p>
      </Section>

      <Section title={copy.addHeading}>
        <RowList>
          {homeAssistant ? null : list.canManage ? (
            <NavRow
              link={linkTo('energyConnect')}
              label={words.connect.title}
              sub={copy.addHomeAssistantSub}
            />
          ) : (
            <ValueRow
              label={words.connect.title}
              sub={copy.adminsConnect}
              value=""
            />
          )}
          <NavRow
            link={linkTo('energyReadings')}
            label={words.readings.title}
            sub={copy.addManualSub}
          />
          {enelogic ? null : list.canManage ? (
            <NavRow
              link={linkTo('energyEnelogic')}
              label={copy.enelogic}
              sub={copy.addEnelogicSub}
            />
          ) : (
            <ValueRow
              label={copy.enelogic}
              sub={copy.adminsConnectEnelogic}
              value=""
            />
          )}
          <ValueRow label={copy.homeWizard} sub={copy.homeWizardSoon} value="" />
        </RowList>
      </Section>
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </h3>
      {children}
    </section>
  )
}

/** One source: its name and its state, in `danger` words when it needs care. */
function SourceRow({
  label,
  line,
  problem,
  link,
}: {
  label: string
  line: string
  problem: boolean
  link: Parameters<typeof NavRow>[0]['link'] | null
}) {
  if (link) return <NavRow link={link} label={label} sub={line} danger={problem} />
  return (
    <div className="grid min-h-14 content-center px-4 py-2">
      <span className="text-base">{label}</span>
      <span
        className={`text-sm ${problem ? 'font-semibold text-[var(--danger)]' : 'text-[var(--muted)]'}`}
      >
        {line}
      </span>
    </div>
  )
}
