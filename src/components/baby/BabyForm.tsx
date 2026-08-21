import {
  BABY_EVENT_TYPES,
  type BabyEventType,
  declinedEventTypes,
  trackedEventTypes,
} from '@gather/core/domain'
import { useState } from 'react'
import { useMessages } from '../../lib/i18n'
import { EventIcon } from './EventIcon'

const inputClass =
  'w-full rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)] disabled:cursor-not-allowed disabled:opacity-60'

export interface BabyFormValues {
  name: string
  birthDate: string
  sex?: 'female' | 'male' | 'unspecified'
  /**
   * What this Child's log will *not* offer (ADR-0022).
   *
   * The boxes on screen ask the opposite question — which types to keep —
   * because that is what a person is answering. The conversion happens here,
   * on the way out, so that the one place a refusal list is built is
   * `declinedEventTypes` and no page has to remember which way round the field
   * is. Ticking everything sends an empty array, which is the same as never
   * having chosen.
   */
  untrackedTypes: BabyEventType[]
}

interface BabyFormProps {
  /**
   * Partial rather than whole: a Child created before ADR-0022 has refused
   * nothing, and the form reads that absence the same way the log does — as
   * every type on offer.
   */
  initial?: Partial<BabyFormValues>
  submitting: boolean
  onSubmit: (values: BabyFormValues) => void
}

export function BabyForm({ initial, submitting, onSubmit }: BabyFormProps) {
  const messages = useMessages()
  const { form, tracked: tracked_ } = messages.baby.log

  const [name, setName] = useState(initial?.name ?? '')
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? '')
  const [sex, setSex] = useState(initial?.sex ?? 'unspecified')
  const [tracked, setTracked] = useState<BabyEventType[]>(() => [
    ...trackedEventTypes(initial?.untrackedTypes),
  ])

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          name: name.trim(),
          birthDate,
          sex,
          untrackedTypes: declinedEventTypes(tracked),
        })
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{form.name}</span>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{form.birthDate}</span>
        <input
          type="date"
          className={inputClass}
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          required
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{form.sex}</span>
        <select
          className={inputClass}
          value={sex}
          onChange={(e) =>
            setSex(e.target.value as NonNullable<BabyFormValues['sex']>)
          }
        >
          <option value="unspecified">{form.sexUnspecified}</option>
          <option value="female">{form.sexFemale}</option>
          <option value="male">{form.sexMale}</option>
        </select>
      </label>
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1 text-sm font-medium">{tracked_.title}</legend>
        <p className="mt-0 mb-2 text-xs text-[var(--app-muted)]">
          {tracked_.keepsEntries}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BABY_EVENT_TYPES.map((type) => {
            const on = tracked.includes(type)
            return (
              <label
                key={type}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--app-radius)] border px-2.5 text-sm font-semibold ${
                  on
                    ? 'border-[var(--app-accent)] bg-[var(--app-surface)]'
                    : 'border-[var(--app-border)] opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={on}
                  onChange={(e) =>
                    setTracked((prev) =>
                      e.target.checked
                        ? [...prev, type]
                        : prev.filter((t) => t !== type),
                    )
                  }
                />
                <EventIcon type={type} className="h-4 w-4" />
                {messages.baby.eventTypes[type]}
              </label>
            )
          })}
        </div>
      </fieldset>
      <button
        type="submit"
        disabled={submitting}
        className="w-fit rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-4 py-2 text-sm font-semibold text-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting
          ? messages.common.actions.saving
          : messages.common.actions.save}
      </button>
    </form>
  )
}
