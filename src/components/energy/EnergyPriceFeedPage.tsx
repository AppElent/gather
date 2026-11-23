import {
  ENERGY_PRICE_PROVIDER_NAMES,
  ENERGY_PRICE_PROVIDERS,
  type EnergyPriceProvider,
  energyPriceNeedsKey,
} from '@gather/core/energy'
import {
  type EnergyPriceView,
  energyPriceStateLine,
} from '@gather/core/energy-present'
import { useMutation, useQuery } from 'convex/react'
import { type FormEvent, useId, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { Breadcrumbs } from '../app/Breadcrumbs'
import { SurfaceCard } from '../app/ShellPrimitives'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { FIELD, PRIMARY, useEnergyMinute, useEnergyRefusal } from './energyShared'

/**
 * The price source (APP-493, design section 4). Admins choose a provider and
 * type its key; everyone sees which one it is and how it is doing. The stored
 * key never comes back here: left empty, it is kept.
 */
export function EnergyPriceFeedPage() {
  const group = useRequiredCurrentGroup()
  const { messages } = useI18n()
  const words = messages.energy
  const copy = words.feed
  const { today, now } = useEnergyMinute()
  const view = useQuery(api.energyPrices.view, {
    groupSlug: group.slug,
    day: today,
  })

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <Breadcrumbs
        trail={[
          {
            label: messages.modules.byId.energy.label,
            link: linkTo('energy'),
          },
          { label: words.prices.title, link: linkTo('energyPrices') },
          { label: copy.title },
        ]}
        className="mb-0"
      />
      <div className="grid gap-1">
        <h2 className="m-0 font-rounded text-2xl font-bold">
          {view ? view.siteName : copy.title}
        </h2>
        <p className="m-0 text-sm text-[var(--muted)]">{copy.sub}</p>
      </div>
      {view === undefined ? (
        <div className="h-40 animate-pulse rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface-2)]" />
      ) : view === null ? (
        <SurfaceCard>
          <p className="m-0 text-sm">{words.empty.summary}</p>
        </SurfaceCard>
      ) : (
        <FeedForm
          // A source somebody else saved replaces what was chosen here.
          key={view.provider}
          groupSlug={group.slug}
          view={view}
          now={now}
        />
      )}
    </div>
  )
}

function FeedForm({
  groupSlug,
  view,
  now,
}: {
  groupSlug: string
  view: EnergyPriceView
  now: number
}) {
  const { messages, locale } = useI18n()
  const words = messages.energy
  const copy = words.feed
  const refusal = useEnergyRefusal()
  const save = useMutation(api.energyPrices.saveFeed)
  const ids = useId()
  const [provider, setProvider] = useState<EnergyPriceProvider>(view.provider)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chosen = provider === view.provider
  const needsKey = energyPriceNeedsKey(provider)
  const stored = chosen && view.hasKey
  const state = energyPriceStateLine(view, now, words, locale)
  const submittable = needsKey ? Boolean(key.trim()) : !chosen

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await save({ groupSlug, provider, ...(key.trim() ? { key } : {}) })
    } catch (caught) {
      setError(refusal(caught))
    } finally {
      // The server has the key, or refused it: it is typed again either way.
      setKey('')
      setBusy(false)
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit} noValidate>
      <div
        role="radiogroup"
        aria-label={copy.choices}
        className="shell-card grid divide-y divide-[var(--hair)] overflow-hidden p-0"
      >
        {ENERGY_PRICE_PROVIDERS.map((each) => (
          <label
            key={each}
            className="flex min-h-14 items-center gap-3 px-4 py-2"
          >
            <input
              type="radio"
              name={`${ids}-provider`}
              className="h-5 w-5 shrink-0 accent-[var(--accent-text)]"
              checked={provider === each}
              disabled={!view.canManage || busy}
              aria-describedby={`${ids}-${each}`}
              onChange={() => {
                setProvider(each)
                setKey('')
                setError(null)
              }}
            />
            <span className="grid min-w-0">
              <span className="text-base">
                {ENERGY_PRICE_PROVIDER_NAMES[each]}
              </span>
              <span
                id={`${ids}-${each}`}
                className="text-sm text-[var(--muted)]"
              >
                {copy[each]}
              </span>
            </span>
          </label>
        ))}
        <label className="flex min-h-14 items-center gap-3 px-4 py-2 opacity-55">
          <input
            type="radio"
            name={`${ids}-provider`}
            className="h-5 w-5 shrink-0"
            disabled
          />
          <span className="grid min-w-0">
            <span className="text-base">{copy.more}</span>
            <span className="text-sm text-[var(--muted)]">{copy.moreSub}</span>
          </span>
        </label>
      </div>

      <p
        role="status"
        className={`m-0 px-1 text-sm ${state.problem ? 'font-semibold text-[var(--danger)]' : 'text-[var(--muted)]'}`}
      >
        {state.text}
      </p>

      {view.canManage && needsKey ? (
        <section className="grid gap-2">
          <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {provider === 'tibber' ? copy.tibberHeading : copy.entsoeHeading}
          </h3>
          <SurfaceCard className="grid gap-3">
            <label
              className="grid gap-1 text-sm font-medium"
              htmlFor={`${ids}-key`}
            >
              {copy.key}
              <input
                id={`${ids}-key`}
                className={FIELD}
                type="password"
                // Not this person's password, so nothing should offer to save it.
                autoComplete="new-password"
                spellCheck={false}
                aria-describedby={`${ids}-help`}
                placeholder={stored ? copy.keyStored : undefined}
                value={key}
                disabled={busy}
                onChange={(event) => {
                  setKey(event.target.value)
                  setError(null)
                }}
              />
            </label>
          </SurfaceCard>
          <p id={`${ids}-help`} className="m-0 text-sm text-[var(--muted)]">
            {provider === 'tibber' ? copy.tibberHelp : copy.entsoeHelp}{' '}
            {copy.keyNote}
          </p>
          {provider === 'tibber' ? (
            <p className="m-0 text-sm">{copy.tibberNote}</p>
          ) : null}
        </section>
      ) : stored ? (
        <p className="m-0 px-1 text-sm">{copy.keyInPlace}</p>
      ) : null}

      {error ? (
        <p role="alert" className="m-0 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      {view.canManage ? (
        <div>
          <button
            type="submit"
            className={PRIMARY}
            disabled={busy || !submittable}
          >
            {busy ? copy.saving : copy.save}
          </button>
        </div>
      ) : (
        <p className="m-0 text-sm">{copy.adminsOnly}</p>
      )}
      <p className="m-0 text-sm text-[var(--muted)]">{copy.footer}</p>
    </form>
  )
}
