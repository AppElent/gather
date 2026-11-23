import { haStatisticFits } from '@gather/core/energy'
import { energyChannelName } from '@gather/core/energy-present'
import { useNavigate } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { type FormEvent, useId, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { fmt, plural, useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { Breadcrumbs } from '../app/Breadcrumbs'
import { useConfirmAction } from '../app/ConfirmAction'
import { SurfaceCard } from '../app/ShellPrimitives'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import {
  FIELD,
  PRIMARY,
  SECONDARY,
  Switch,
  useEnergyRefusal,
} from './energyShared'

type SourceList = NonNullable<FunctionReturnType<typeof api.energySources.list>>
type Tested = FunctionReturnType<typeof api.energyHomeAssistant.test>

/**
 * Connecting Home Assistant (APP-495, design section 9), for admins: the
 * address and token, then one switch per channel its Energy dashboard names.
 * The stored token never comes back here: left empty, it is kept.
 */
export function EnergyConnectPage() {
  const group = useRequiredCurrentGroup()
  const { messages } = useI18n()
  const copy = messages.energy.connect
  const list = useQuery(api.energySources.list, { groupSlug: group.slug })

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <Breadcrumbs
        trail={[
          {
            label: messages.modules.byId.energy.label,
            link: linkTo('energy'),
          },
          {
            label: messages.energy.sources.title,
            link: linkTo('energySources'),
          },
          { label: copy.title },
        ]}
        className="mb-0"
      />
      <div className="grid gap-1">
        <h2 className="m-0 font-rounded text-2xl font-bold">{copy.summary}</h2>
        <p className="m-0 text-sm text-[var(--muted)]">{copy.summarySub}</p>
      </div>
      {list === undefined ? (
        <div className="h-40 animate-pulse rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface-2)]" />
      ) : list === null ? (
        <SurfaceCard>
          <p className="m-0 text-sm">{messages.energy.empty.summary}</p>
        </SurfaceCard>
      ) : list.canManage ? (
        <ConnectForm groupSlug={group.slug} list={list} />
      ) : (
        <SurfaceCard>
          <p className="m-0 text-sm">{copy.adminsOnly}</p>
        </SurfaceCard>
      )}
    </div>
  )
}

function ConnectForm({
  groupSlug,
  list,
}: {
  groupSlug: string
  list: SourceList
}) {
  const { messages, locale } = useI18n()
  const words = messages.energy
  const copy = words.connect
  const refusal = useEnergyRefusal()
  const test = useAction(api.energyHomeAssistant.test)
  const connect = useAction(api.energyHomeAssistant.connect)
  const disconnect = useMutation(api.energySources.disconnect)
  const navigate = useNavigate()
  const { confirm, dialog } = useConfirmAction()
  const ids = useId()
  const existing = list.sources.find((each) => each.kind === 'homeAssistant')
  const connected = existing?.connected ?? false
  const [address, setAddress] = useState(list.homeAssistantAddress ?? '')
  const [token, setToken] = useState('')
  const [tested, setTested] = useState<Tested | null>(null)
  const [history, setHistory] = useState(!connected)
  const [busy, setBusy] = useState<'test' | 'connect' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The stored token is for the stored address only.
  const connection = {
    groupSlug,
    address,
    ...(token.trim() ? { token } : {}),
  }
  const stale = () => {
    setTested(null)
    setError(null)
  }

  const runTest = async (event: FormEvent) => {
    event.preventDefault()
    setBusy('test')
    stale()
    try {
      setTested(await test(connection))
    } catch (caught) {
      setError(refusal(caught))
    } finally {
      setBusy(null)
    }
  }

  const runConnect = async () => {
    if (!tested) return
    const channels = tested.proposals.filter((each) => each.on)
    if (channels.length === 0) {
      setError(words.refusals.pickChannel)
      return
    }
    setBusy('connect')
    setError(null)
    try {
      await connect({
        ...connection,
        channels: channels.map(({ kind, tariff, statisticId }) => ({
          kind,
          ...(tariff ? { tariff } : {}),
          statisticId,
        })),
        history,
      })
      await navigate(linkTo('energySources'))
    } catch (caught) {
      setError(refusal(caught))
      setBusy(null)
    }
  }

  const change = (
    at: number,
    patch: Partial<Tested['proposals'][number]>,
  ) =>
    setTested((current) =>
      current
        ? {
            ...current,
            proposals: current.proposals.map((each, index) =>
              index === at ? { ...each, ...patch } : each,
            ),
          }
        : current,
    )

  return (
    <>
      <form className="grid gap-2" onSubmit={runTest} noValidate>
        <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {copy.stepConnection}
        </h3>
        <SurfaceCard className="grid gap-3">
          <label
            className="grid gap-1 text-sm font-medium"
            htmlFor={`${ids}-address`}
          >
            {copy.address}
            <input
              id={`${ids}-address`}
              className={FIELD}
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder={copy.addressPlaceholder}
              aria-describedby={`${ids}-hint`}
              value={address}
              onChange={(event) => {
                setAddress(event.target.value)
                stale()
              }}
            />
          </label>
          <label
            className="grid gap-1 text-sm font-medium"
            htmlFor={`${ids}-token`}
          >
            {copy.token}
            <input
              id={`${ids}-token`}
              className={FIELD}
              type="password"
              // Not this person's password, so nothing should offer to save it.
              autoComplete="new-password"
              spellCheck={false}
              aria-describedby={`${ids}-hint`}
              placeholder={connected ? copy.tokenStored : undefined}
              value={token}
              onChange={(event) => {
                setToken(event.target.value)
                stale()
              }}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className={tested ? SECONDARY : PRIMARY}
              disabled={busy !== null || !address.trim()}
            >
              {busy === 'test' ? copy.testing : copy.test}
            </button>
          </div>
          {tested ? (
            <p role="status" className="m-0 text-sm font-semibold">
              {tested.hasDashboard
                ? plural(locale, tested.proposals.length, {
                    one: fmt(copy.tested.one, { version: tested.version }),
                    other: fmt(copy.tested.other, { version: tested.version }),
                  })
                : fmt(copy.testedNoDashboard, { version: tested.version })}
            </p>
          ) : null}
        </SurfaceCard>
        <p id={`${ids}-hint`} className="m-0 text-sm text-[var(--muted)]">
          {copy.hint}
        </p>
      </form>

      {tested && tested.proposals.length > 0 ? (
        <section className="grid gap-2">
          <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {copy.stepChannels}
          </h3>
          <div className="shell-card grid divide-y divide-[var(--hair)] overflow-hidden p-0">
            {tested.proposals.map((proposal, index) => (
              <ChannelRow
                // A proposal keeps its place while its sensor changes.
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed order
                key={index}
                proposal={proposal}
                statistics={tested.statistics}
                onChange={(patch) => change(index, patch)}
              />
            ))}
          </div>
          <p className="m-0 text-sm text-[var(--muted)]">
            {channelsHint(tested, words)}
          </p>
          <SurfaceCard className="flex items-center justify-between gap-3">
            <span className="grid">
              <span className="text-base">{copy.history}</span>
              <span
                id={`${ids}-history`}
                className="text-sm text-[var(--muted)]"
              >
                {copy.historySub}
              </span>
            </span>
            <Switch
              on={history}
              onChange={setHistory}
              label={copy.history}
              describedBy={`${ids}-history`}
            />
          </SurfaceCard>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="m-0 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {tested && tested.proposals.length > 0 ? (
        <div>
          <button
            type="button"
            className={PRIMARY}
            disabled={busy !== null}
            onClick={() => void runConnect()}
          >
            {connected
              ? busy === 'connect'
                ? copy.saving
                : copy.save
              : busy === 'connect'
                ? copy.submitting
                : copy.submit}
          </button>
        </div>
      ) : null}
      <p className="m-0 text-sm text-[var(--muted)]">{copy.footer}</p>

      {connected ? (
        <div>
          <button
            type="button"
            className={SECONDARY}
            disabled={busy !== null}
            onClick={() =>
              confirm({
                title: copy.disconnectTitle,
                body: copy.disconnectBody,
                confirmLabel: copy.disconnect,
                run: async () => {
                  await disconnect({ groupSlug })
                  await navigate(linkTo('energySources'))
                },
              })
            }
          >
            {copy.disconnect}
          </button>
        </div>
      ) : null}
      {dialog}
    </>
  )
}

/** Where the channels come from, and why a supplied one starts off. */
function channelsHint(
  tested: Tested,
  words: ReturnType<typeof useI18n>['messages']['energy'],
): string {
  const supplied = tested.proposals.find((each) => each.suppliedBy && !each.on)
  return [
    words.connect.channelsHint,
    supplied
      ? fmt(words.connect.channelsHintSupplied, {
          channel: energyChannelName(supplied, words),
          source: supplied.suppliedBy ?? '',
        })
      : null,
  ]
    .filter(Boolean)
    .join(' ')
}

function ChannelRow({
  proposal,
  statistics,
  onChange,
}: {
  proposal: Tested['proposals'][number]
  statistics: Tested['statistics']
  onChange: (patch: Partial<Tested['proposals'][number]>) => void
}) {
  const { messages } = useI18n()
  const copy = messages.energy.connect
  const id = useId()
  const name = energyChannelName(proposal, messages.energy)
  const fitting = statistics.filter((each) =>
    haStatisticFits(each, proposal.kind),
  )
  const note = !proposal.available
    ? { text: copy.missing, problem: true }
    : proposal.suppliedBy
      ? {
          text: fmt(proposal.on ? copy.replaces : copy.supplied, {
            source: proposal.suppliedBy,
          }),
          problem: false,
        }
      : null

  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2">
      <div className="grid min-w-0 flex-1 gap-1">
        <span className="text-base">{name}</span>
        <select
          className="min-h-9 w-full min-w-0 rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface)] px-2 text-[16px] text-[var(--muted)] sm:text-sm"
          aria-label={fmt(copy.pickSensor, { name })}
          value={proposal.statisticId}
          onChange={(event) =>
            onChange({
              statisticId: event.target.value,
              available: true,
              on: true,
            })
          }
        >
          {fitting.some((each) => each.id === proposal.statisticId) ? null : (
            <option value={proposal.statisticId}>{proposal.statisticId}</option>
          )}
          {fitting.map((each) => (
            <option key={each.id} value={each.id}>
              {each.name && each.name !== each.id
                ? `${each.id} (${each.name})`
                : each.id}
            </option>
          ))}
        </select>
        {note ? (
          <span
            id={`${id}-note`}
            className={`text-sm ${note.problem ? 'font-semibold text-[var(--danger)]' : 'text-[var(--muted)]'}`}
          >
            {note.text}
          </span>
        ) : null}
      </div>
      <Switch
        on={proposal.on}
        onChange={(on) => onChange({ on })}
        label={fmt(copy.readChannel, { name })}
        describedBy={note ? `${id}-note` : undefined}
        disabled={!proposal.available && !proposal.on}
      />
    </div>
  )
}
