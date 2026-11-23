import {
  checkEnergyReading,
  type EnergyReadingProblem,
  parseMeterReading,
} from '@gather/core/energy'
import {
  energyChannelName,
  formatEnergyNumber,
} from '@gather/core/energy-present'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { type FormEvent, useId, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { fmt, type Messages, useI18n } from '../../lib/i18n'
import { Breadcrumbs } from '../app/Breadcrumbs'
import { SurfaceCard } from '../app/ShellPrimitives'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import {
  energyTrail,
  FIELD,
  PRIMARY,
  readingDate,
  useEnergyRefusal,
  useEnergyToday,
} from './energyShared'

type ReadingForm = NonNullable<FunctionReturnType<typeof api.energyReadings.form>>
type Channel = ReadingForm['channels'][number]

/** As many decimals as the meter gave, at most three: 24.219,8 or 8.123,456. */
function readingNumber(value: number, locale: string): string {
  const decimals = Math.min(3, (String(value).split('.')[1] ?? '').length)
  return formatEnergyNumber(value, locale, Math.max(1, decimals))
}

/**
 * Typing meter readings (APP-494, design section 10).
 *
 * One cumulative reading per meter for a day. A reading lower than the one
 * before it is refused inline, before anything is sent, because a meter only
 * counts up: a new meter is a new channel under Sources. A site without typed
 * meters first says which ones it reads.
 */
export function EnergyReadingsPage() {
  const group = useRequiredCurrentGroup()
  const { messages } = useI18n()
  const copy = messages.energy.readings
  const { today } = useEnergyToday()
  const [day, setDay] = useState(today)
  const form = useQuery(api.energyReadings.form, { groupSlug: group.slug, day })
  const ids = useId()
  // The date stays on screen while another day loads, so it keeps its focus.
  const [hasMeters, setHasMeters] = useState(false)
  if (form && form.channels.length > 0 && !hasMeters) setHasMeters(true)
  const showDate = hasMeters && form !== null

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <Breadcrumbs trail={energyTrail(messages, copy.title)} className="mb-0" />
      <h2 className="m-0 text-2xl font-semibold">{copy.title}</h2>
      {showDate ? (
        <SurfaceCard className="grid gap-2">
          <label
            className="grid gap-1 text-sm font-medium"
            htmlFor={`${ids}-day`}
          >
            {copy.date}
            <input
              id={`${ids}-day`}
              type="date"
              className={FIELD}
              value={day}
              max={today}
              required
              onChange={(event) => {
                const picked = event.target.value
                if (picked && picked <= today) setDay(picked)
              }}
            />
          </label>
        </SurfaceCard>
      ) : null}
      {form === undefined ? (
        <div className="h-40 animate-pulse rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface-2)]" />
      ) : form === null ? (
        <SurfaceCard>
          <p className="m-0 text-sm">{messages.energy.empty.summary}</p>
        </SurfaceCard>
      ) : form.channels.length === 0 ? (
        <SetupMeters groupSlug={group.slug} />
      ) : (
        <ReadingsForm
          // A new day starts from empty fields.
          key={day}
          groupSlug={group.slug}
          form={form}
          day={day}
        />
      )}
    </div>
  )
}

function problemText(
  problem: EnergyReadingProblem,
  channel: Channel,
  messages: Messages,
  locale: string,
): string {
  const copy = messages.energy.readings
  if (problem === 'lowerThanPrevious' && channel.previous) {
    return fmt(copy.lower, {
      value: readingNumber(channel.previous.value, locale),
    })
  }
  if (problem === 'higherThanNext' && channel.next) {
    return fmt(copy.higher, {
      value: readingNumber(channel.next.value, locale),
      date: readingDate(channel.next.at, locale),
    })
  }
  return problem === 'negative' ? copy.negative : copy.notANumber
}

function ReadingsForm({
  groupSlug,
  form,
  day,
}: {
  groupSlug: string
  form: ReadingForm
  day: string
}) {
  const { messages, locale } = useI18n()
  const copy = messages.energy.readings
  const refusal = useEnergyRefusal()
  const save = useMutation(api.energyReadings.save)
  const ids = useId()
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  /** The problem with one field, or null; a blank field is skipped. */
  const check = (channel: Channel, text: string): string | null => {
    if (!text.trim()) return null
    const value = parseMeterReading(text)
    const problem = checkEnergyReading(value, {
      previous: channel.previous?.value,
      next: channel.next?.value,
    })
    return problem ? problemText(problem, channel, messages, locale) : null
  }

  const validate = (channel: Channel) => {
    const problem = check(channel, values[channel._id] ?? '')
    setErrors((current) => {
      const next = { ...current }
      if (problem) next[channel._id] = problem
      else delete next[channel._id]
      return next
    })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaved(false)
    setFormError(null)
    const found: Record<string, string> = {}
    const readings: { channelId: Id<'energyChannels'>; value: number }[] = []
    for (const channel of form.channels) {
      const text = values[channel._id] ?? ''
      const problem = check(channel, text)
      if (problem) found[channel._id] = problem
      else if (text.trim()) {
        readings.push({
          channelId: channel._id,
          value: parseMeterReading(text) as number,
        })
      }
    }
    setErrors(found)
    if (Object.keys(found).length > 0) return
    if (readings.length === 0) {
      setFormError(copy.nothingTyped)
      return
    }
    setSaving(true)
    try {
      await save({ groupSlug, day, readings })
      setValues({})
      setSaved(true)
    } catch (caught) {
      setFormError(refusal(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit} noValidate>
      <SurfaceCard className="grid gap-4">
        <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {copy.heading}
        </h3>
        {form.channels.map((channel) => {
          const id = `${ids}-${channel._id}`
          const unit = messages.energy.units[channel.unit]
          const error = errors[channel._id]
          const hints = [
            `${id}-previous`,
            channel.onDay ? `${id}-replaces` : null,
            error ? `${id}-error` : null,
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <div key={channel._id} className="grid gap-1">
              <label htmlFor={id} className="text-sm font-semibold">
                {energyChannelName(channel, messages.energy)}
              </label>
              <p
                id={`${id}-previous`}
                className="m-0 text-sm text-[var(--muted)]"
              >
                {channel.previous
                  ? fmt(copy.previous, {
                      value: readingNumber(channel.previous.value, locale),
                      unit,
                      date: readingDate(channel.previous.at, locale),
                    })
                  : copy.previousNone}
              </p>
              <div className="flex items-center gap-2">
                <input
                  id={id}
                  className={FIELD}
                  inputMode="decimal"
                  autoComplete="off"
                  value={values[channel._id] ?? ''}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={hints}
                  onChange={(event) => {
                    const text = event.target.value
                    setValues((current) => ({
                      ...current,
                      [channel._id]: text,
                    }))
                    setSaved(false)
                  }}
                  onBlur={() => validate(channel)}
                />
                <span className="w-10 shrink-0 text-sm text-[var(--muted)]">
                  {unit}
                </span>
              </div>
              {channel.onDay ? (
                <p
                  id={`${id}-replaces`}
                  className="m-0 text-xs text-[var(--muted)]"
                >
                  {fmt(copy.replaces, {
                    value: readingNumber(channel.onDay.value, locale),
                    unit,
                  })}
                </p>
              ) : null}
              {error ? (
                <p
                  id={`${id}-error`}
                  role="alert"
                  className="m-0 text-sm text-[var(--danger)]"
                >
                  {error}
                </p>
              ) : null}
            </div>
          )
        })}
      </SurfaceCard>

      <p className="m-0 text-sm text-[var(--muted)]">{copy.footnote}</p>

      {formError ? (
        <p role="alert" className="m-0 text-sm text-[var(--danger)]">
          {formError}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="m-0 text-sm font-semibold">
          {copy.saved}
        </p>
      ) : null}

      <div>
        <button type="submit" className={PRIMARY} disabled={saving}>
          {saving ? copy.saving : copy.save}
        </button>
      </div>
    </form>
  )
}

/** Which meters the Group reads: one channel per counter. */
function SetupMeters({ groupSlug }: { groupSlug: string }) {
  const { messages } = useI18n()
  const copy = messages.energy.readings
  const refusal = useEnergyRefusal()
  const setup = useMutation(api.energyReadings.setupChannels)
  const ids = useId()
  const [choice, setChoice] = useState({ split: false, export: false, gas: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const options: {
    key: keyof typeof choice
    label: string
    hint: string
  }[] = [
    { key: 'split', label: copy.setupSplit, hint: copy.setupSplitHint },
    { key: 'export', label: copy.setupExport, hint: copy.setupExportHint },
    { key: 'gas', label: copy.setupGas, hint: copy.setupGasHint },
  ]

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await setup({
        groupSlug,
        ...choice,
        sourceLabel: messages.energy.site.manualSourceLabel,
      })
    } catch (caught) {
      setError(refusal(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <SurfaceCard className="grid gap-3">
        <h3 className="m-0 text-lg font-semibold">{copy.setupTitle}</h3>
        <p className="m-0 text-sm text-[var(--muted)]">{copy.setupBody}</p>
        {options.map((option) => (
          <label
            key={option.key}
            htmlFor={`${ids}-${option.key}`}
            className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-[var(--hair)] p-3 has-[:checked]:border-[var(--ink)]"
          >
            <input
              id={`${ids}-${option.key}`}
              type="checkbox"
              checked={choice[option.key]}
              aria-describedby={`${ids}-${option.key}-hint`}
              onChange={(event) => {
                const checked = event.target.checked
                setChoice((current) => ({ ...current, [option.key]: checked }))
              }}
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent-text)]"
            />
            <span className="grid gap-0.5">
              <span className="text-sm font-semibold">{option.label}</span>
              <span
                id={`${ids}-${option.key}-hint`}
                className="text-xs text-[var(--muted)]"
              >
                {option.hint}
              </span>
            </span>
          </label>
        ))}
        {error ? (
          <p role="alert" className="m-0 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}
        <div>
          <button type="submit" className={PRIMARY} disabled={saving}>
            {copy.setupSubmit}
          </button>
        </div>
      </SurfaceCard>
    </form>
  )
}
