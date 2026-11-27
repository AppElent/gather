import { enelogicRateChannel, parseEnelogicRef } from '@gather/core/energy'
import {
  energyChannelName,
  energySourceProblemLine,
} from '@gather/core/energy-present'
import { useNavigate } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useId, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { fmt, plural, useI18n } from '../../lib/i18n'
import { hrefTo, linkTo } from '../../lib/links'
import { newOAuthState, oauthRedirectUri } from '../../lib/oauth'
import { Breadcrumbs } from '../app/Breadcrumbs'
import { useConfirmAction } from '../app/ConfirmAction'
import { SurfaceCard } from '../app/ShellPrimitives'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { PRIMARY, SECONDARY, Switch, useEnergyRefusal } from './energyShared'

type SourceList = NonNullable<FunctionReturnType<typeof api.energySources.list>>
type Tested = FunctionReturnType<typeof api.energyEnelogic.test>
type Proposal = Tested['proposals'][number]

/**
 * Connecting Enelogic (APP-497), for admins, in the Home Assistant pattern:
 * sign in at Enelogic, then one switch per channel its measuring points read.
 * The access Enelogic gives never comes back here.
 */
export function EnergyEnelogicPage() {
  const group = useRequiredCurrentGroup()
  const { messages } = useI18n()
  const copy = messages.energy.enelogic
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
        <h1 className="m-0 font-rounded text-2xl font-bold">{copy.summary}</h1>
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
  const copy = words.enelogic
  const refusal = useEnergyRefusal()
  const authorizeUrl = useAction(api.energyEnelogic.authorizeUrl)
  const test = useAction(api.energyEnelogic.test)
  const connect = useAction(api.energyEnelogic.connect)
  const disconnect = useMutation(api.energySources.disconnect)
  const navigate = useNavigate()
  const { confirm, dialog } = useConfirmAction()
  const ids = useId()
  const existing = list.sources.find((each) => each.kind === 'enelogic')
  const signedIn = existing?.connected ?? false
  const refused = existing?.status === 'needsReconnect'
  const editing = signedIn && (existing?.channelCount ?? 0) > 0
  const [tested, setTested] = useState<Tested | null>(null)
  const [history, setHistory] = useState(!editing)
  const [busy, setBusy] = useState<'signIn' | 'read' | 'connect' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const problem = existing
    ? energySourceProblemLine(existing, Date.now(), words, locale)
    : null

  const signIn = async () => {
    setBusy('signIn')
    setError(null)
    try {
      window.location.href = await authorizeUrl({
        groupSlug,
        redirectUri: oauthRedirectUri(),
        state: newOAuthState('enelogic', groupSlug, hrefTo('energyEnelogic')),
      })
    } catch (caught) {
      setError(refusal(caught))
      setBusy(null)
    }
  }

  const read = async () => {
    setBusy('read')
    setError(null)
    setTested(null)
    try {
      setTested(await test({ groupSlug }))
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
        groupSlug,
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

  const change = (at: number, patch: Partial<Proposal>) =>
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
      <section className="grid gap-2">
        <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {copy.stepAccount}
        </h3>
        <SurfaceCard className="grid gap-3">
          {signedIn && !refused ? (
            <p className="m-0 text-sm font-semibold">{copy.accountConnected}</p>
          ) : null}
          {problem ? (
            <p className="m-0 text-sm font-semibold text-[var(--danger)]">
              {problem}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {signedIn && !refused ? (
              <button
                type="button"
                className={tested ? SECONDARY : PRIMARY}
                disabled={busy !== null}
                onClick={() => void read()}
              >
                {busy === 'read' ? copy.reading : copy.read}
              </button>
            ) : null}
            <button
              type="button"
              className={signedIn && !refused ? SECONDARY : PRIMARY}
              disabled={busy !== null}
              onClick={() => void signIn()}
            >
              {busy === 'signIn'
                ? copy.signingIn
                : signedIn
                  ? copy.signInAgain
                  : copy.signIn}
            </button>
          </div>
          {tested ? (
            <p role="status" className="m-0 text-sm font-semibold">
              {tested.proposals.length > 0
                ? plural(locale, tested.proposals.length, copy.found)
                : copy.foundNone}
            </p>
          ) : null}
        </SurfaceCard>
        <p className="m-0 text-sm text-[var(--muted)]">{copy.accountHint}</p>
      </section>

      {tested && tested.proposals.length > 0 ? (
        <section className="grid gap-2">
          <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {copy.stepChannels}
          </h3>
          <div className="shell-card grid divide-y divide-[var(--hair)] overflow-hidden p-0">
            {tested.proposals.map((proposal, index) => (
              <ChannelRow
                // A proposal keeps its place while its register changes.
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed order
                key={index}
                proposal={proposal}
                statistics={tested.statistics}
                onChange={(patch) => change(index, patch)}
              />
            ))}
          </div>
          <p className="m-0 text-sm text-[var(--muted)]">{copy.channelsHint}</p>
          <SurfaceCard className="flex items-center justify-between gap-3">
            <span className="grid">
              <span className="text-base">{words.connect.history}</span>
              <span
                id={`${ids}-history`}
                className="text-sm text-[var(--muted)]"
              >
                {words.connect.historySub}
              </span>
            </span>
            <Switch
              on={history}
              onChange={setHistory}
              label={words.connect.history}
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
            {editing
              ? busy === 'connect'
                ? words.connect.saving
                : words.connect.save
              : busy === 'connect'
                ? words.connect.submitting
                : words.connect.submit}
          </button>
        </div>
      ) : null}
      <p className="m-0 text-sm text-[var(--muted)]">{copy.footer}</p>

      {signedIn ? (
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
                  await disconnect({ groupSlug, kind: 'enelogic' })
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

/** Whether a register reads this channel: its kind and its tariff. */
function registerFits(
  statistic: Tested['statistics'][number],
  proposal: Pick<Proposal, 'kind' | 'tariff'>,
): boolean {
  const ref = parseEnelogicRef(statistic.id)
  const read = ref && enelogicRateChannel(ref.rate, statistic.measure === 'volume')
  return read?.kind === proposal.kind && read.tariff === proposal.tariff
}

function ChannelRow({
  proposal,
  statistics,
  onChange,
}: {
  proposal: Proposal
  statistics: Tested['statistics']
  onChange: (patch: Partial<Proposal>) => void
}) {
  const { messages } = useI18n()
  const copy = messages.energy.connect
  const id = useId()
  const name = energyChannelName(proposal, messages.energy)
  const fitting = statistics.filter((each) => registerFits(each, proposal))
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
              {each.name ?? each.id}
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
