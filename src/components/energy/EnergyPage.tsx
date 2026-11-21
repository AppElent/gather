import { checkEnergySiteName, ENERGY_LIMITS } from '@gather/core/energy'
import { readEnergyRefusal } from '@gather/core/refusals'
import { useMutation, useQuery } from 'convex/react'
import { type FormEvent, useId, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { errorMessage } from '../../lib/errorMessage'
import { useI18n } from '../../lib/i18n'
import { SurfaceCard } from '../app/ShellPrimitives'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'

const PRIMARY =
  'inline-flex min-h-10 items-center justify-center rounded-[var(--app-radius)] bg-[var(--app-accent)] px-4 text-sm font-semibold text-white disabled:opacity-60'
const FIELD =
  'min-h-11 w-full rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-[16px] text-[var(--app-fg)] sm:text-sm'

type SourceChoice = 'homeAssistant' | 'manual'

/**
 * The Energy Module (APP-492): the Group's address, or the way to add one.
 *
 * Empty, it says what the Module is for and offers one step: adding an address
 * (ADR-0022). The form asks a name, an optional House from Finances and how the
 * data comes in, as `designs/energy/Main.dc.html` draws it. Choosing meter
 * readings saves that source with the address; Home Assistant is connected on
 * its own screen later (APP-495), so choosing it saves the address alone.
 *
 * With an address, the page is the shell the next issues fill: its name, its
 * source and what is coming.
 */
export function EnergyPage() {
  const group = useRequiredCurrentGroup()
  const overview = useQuery(api.energy.overview, { groupSlug: group.slug })
  const { messages } = useI18n()

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <header>
        <div className="min-w-0">
          <h2 className="m-0 text-2xl font-semibold">
            {messages.modules.byId.energy.label}
          </h2>
          <p className="mt-1 text-sm text-[var(--app-muted)]">
            {overview === undefined
              ? ' '
              : overview
                ? overview.site.name
                : messages.energy.empty.summary}
          </p>
        </div>
      </header>

      {overview === undefined ? (
        <div className="h-40 animate-pulse rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface-muted)]" />
      ) : overview ? (
        <SiteShell overview={overview} />
      ) : (
        <AddFirstAddress groupSlug={group.slug} />
      )}
    </div>
  )
}

function SiteShell({
  overview,
}: {
  overview: {
    site: { name: string }
    sources: { kind: string; label: string }[]
  }
}) {
  const copy = useI18n().messages.energy.site
  const manual = overview.sources.find((source) => source.kind === 'manual')
  return (
    <>
      <SurfaceCard className="grid gap-1">
        <h3 className="m-0 text-lg font-semibold">{overview.site.name}</h3>
        <p className="m-0 text-sm text-[var(--app-muted)]">
          {overview.sources.length === 0
            ? copy.sourceNone
            : overview.sources.map((source) => source.label).join(' · ')}
        </p>
      </SurfaceCard>
      <SurfaceCard className="grid gap-1">
        <h3 className="m-0 text-sm font-semibold">{copy.nextTitle}</h3>
        <p className="m-0 text-sm text-[var(--app-muted)]">
          {manual ? copy.nextManual : copy.nextHomeAssistant}
        </p>
      </SurfaceCard>
    </>
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
        <p className="m-0 max-w-xl text-sm text-[var(--app-muted)]">
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
  const copy = messages.energy
  const houses = useQuery(api.houses.list, { groupSlug })
  const createSite = useMutation(api.energy.createSite)
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
    } catch (caught) {
      const code = readEnergyRefusal(caught)
      setError(
        code
          ? copy.refusals[code]
          : errorMessage(caught, messages.common.errors.didNotWork),
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
        <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
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
          className="m-0 text-xs text-[var(--app-muted)]"
        >
          {copy.form.houseHint}
        </p>
      </SurfaceCard>

      <SurfaceCard className="grid gap-3">
        <fieldset className="m-0 grid gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
            {copy.form.sourceHeading}
          </legend>
          {options.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-[var(--app-radius)] border border-[var(--app-border)] p-3 has-[:checked]:border-[var(--app-accent)]"
            >
              <input
                type="radio"
                name={`${ids}-source`}
                value={option.value}
                checked={source === option.value}
                onChange={() => setSource(option.value)}
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--app-accent)]"
              />
              <span className="grid gap-0.5">
                <span className="text-sm font-semibold">{option.label}</span>
                <span className="text-xs text-[var(--app-muted)]">
                  {option.hint}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      </SurfaceCard>

      {error ? (
        <p role="alert" className="m-0 text-sm text-[var(--app-danger)]">
          {error}
        </p>
      ) : null}

      <div className="grid gap-2">
        <div>
          <button type="submit" className={PRIMARY} disabled={saving}>
            {saving ? copy.form.saving : copy.form.submit}
          </button>
        </div>
        <p className="m-0 text-xs text-[var(--app-muted)]">
          {copy.form.footnote}
        </p>
      </div>
    </form>
  )
}
