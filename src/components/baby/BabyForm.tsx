import type { BabySex } from '@gather/core/baby-events'
import {
  arrangeBarEvents,
  BABY_EVENT_TYPES,
  type BabyBarSlot,
  type BabyEventType,
  babyBarSlots,
  declinedEventTypes,
  isBabyBarShortcut,
  trackedEventTypes,
} from '@gather/core/domain'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { fmt, useMessages } from '../../lib/i18n'
import { buttonClass } from '../app/buttons'
import { EventIcon } from './EventIcon'

const inputClass =
  'w-full rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60'

export interface BabyFormValues {
  name: string
  birthDate: string
  sex?: BabySex
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
  /**
   * Where each button sits on the log bar. Only sent when the form was asked
   * to order the bar (`ordersBar`), and always with the phone's two shortcuts
   * left in the slots they held, since this form does not draw them.
   */
  barOrder?: BabyBarSlot[]
}

interface BabyFormProps {
  /**
   * Partial rather than whole: a Child created before ADR-0022 has refused
   * nothing, and the form reads that absence the same way the log does — as
   * every type on offer.
   */
  initial?: Partial<BabyFormValues>
  submitting: boolean
  /**
   * Show the order of the log bar. Off on the create form: a new Child has
   * no arrangement yet, and the tracked order is what the bar starts from.
   */
  ordersBar?: boolean
  onSubmit: (values: BabyFormValues) => void
}

/**
 * Every event type in the household's order: the stored arrangement first,
 * then the types it has never placed in catalogue order. Untracked types keep
 * a place too, so turning one off and on again inside one edit does not lose
 * where it was.
 */
function initialEventOrder(
  stored: readonly BabyBarSlot[] | undefined,
): BabyEventType[] {
  return babyBarSlots(BABY_EVENT_TYPES, stored).filter(
    (slot): slot is BabyEventType => !isBabyBarShortcut(slot),
  )
}

export function BabyForm({
  initial,
  submitting,
  ordersBar = false,
  onSubmit,
}: BabyFormProps) {
  const messages = useMessages()
  const { form, tracked: tracked_ } = messages.baby.log

  const [name, setName] = useState(initial?.name ?? '')
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? '')
  const [sex, setSex] = useState(initial?.sex ?? 'unspecified')
  const [tracked, setTracked] = useState<BabyEventType[]>(() => [
    ...trackedEventTypes(initial?.untrackedTypes),
  ])
  const [order, setOrder] = useState<BabyEventType[]>(() =>
    initialEventOrder(initial?.barOrder),
  )
  /** The bar's event buttons, in the order they will be drawn. */
  const barEvents = order.filter((type) => tracked.includes(type))

  // The arrow keeps focus after a move, so a screen reader hears nothing
  // unless this says where the type went.
  const [announcement, setAnnouncement] = useState('')
  // A move that lands a type at an end disables the arrow just pressed, which
  // would drop focus to the page; the opposite arrow takes it instead.
  const orderRef = useRef<HTMLOListElement>(null)
  const [focusMove, setFocusMove] = useState<string | null>(null)
  useEffect(() => {
    if (!focusMove) return
    orderRef.current
      ?.querySelector<HTMLButtonElement>(`[data-move="${focusMove}"]`)
      ?.focus()
    setFocusMove(null)
  }, [focusMove])

  const move = (type: BabyEventType, direction: 'up' | 'down') => {
    const at = barEvents.indexOf(type)
    const to = direction === 'up' ? at - 1 : at + 1
    if (at < 0 || to < 0 || to >= barEvents.length) return
    const next = [...barEvents]
    ;[next[at], next[to]] = [next[to], next[at]]
    // Untracked types keep their own places; the tracked ones take the
    // tracked places in their new order.
    const queue = [...next]
    setOrder((prev) =>
      prev.map((t) => (tracked.includes(t) ? (queue.shift() ?? t) : t)),
    )
    if (to === 0) setFocusMove(`${type}:down`)
    else if (to === next.length - 1) setFocusMove(`${type}:up`)
    setAnnouncement(
      fmt(tracked_.moved, {
        type: messages.baby.eventTypes[type],
        position: to + 1,
        total: next.length,
      }),
    )
  }

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
          ...(ordersBar
            ? { barOrder: arrangeBarEvents(initial?.barOrder, barEvents) }
            : {}),
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
        <p className="mt-0 mb-2 text-xs text-[var(--muted)]">
          {tracked_.keepsEntries}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BABY_EVENT_TYPES.map((type) => {
            const on = tracked.includes(type)
            return (
              <label
                key={type}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border px-2.5 text-sm font-semibold ${
                  on
                    ? 'border-[var(--ink)] bg-[var(--surface)]'
                    : 'border-[var(--hair)] opacity-60'
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
      {ordersBar && barEvents.length > 1 ? (
        <section aria-labelledby="bar-order-heading">
          <h2
            id="bar-order-heading"
            className="m-0 mb-1 text-sm font-medium"
          >
            {tracked_.orderTitle}
          </h2>
          <p className="mt-0 mb-2 text-xs text-[var(--muted)]">
            {tracked_.orderHint}
          </p>
          <p role="status" aria-live="polite" className="sr-only">
            {announcement}
          </p>
          <ol
            ref={orderRef}
            className="m-0 grid list-none gap-0 overflow-hidden rounded-[var(--radius-card)] bg-[var(--surface)] p-0"
          >
            {barEvents.map((type, index) => {
              const label = messages.baby.eventTypes[type]
              return (
                <li
                  key={type}
                  className="flex min-h-12 items-center gap-3 border-b border-[var(--hair)] px-3 py-1.5 text-sm font-semibold last:border-b-0"
                >
                  <span className="w-5 text-xs text-[var(--muted)] tabular-nums">
                    {index + 1}
                  </span>
                  <EventIcon type={type} className="h-4 w-4" />
                  <span className="flex-1">{label}</span>
                  <button
                    type="button"
                    className={buttonClass.smallRound}
                    disabled={index === 0}
                    data-move={`${type}:up`}
                    aria-label={fmt(tracked_.moveUp, { type: label })}
                    onClick={() => move(type, 'up')}
                  >
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={buttonClass.smallRound}
                    disabled={index === barEvents.length - 1}
                    data-move={`${type}:down`}
                    aria-label={fmt(tracked_.moveDown, { type: label })}
                    onClick={() => move(type, 'down')}
                  >
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ol>
        </section>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="w-fit rounded-[var(--radius-control)] border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting
          ? messages.common.actions.saving
          : messages.common.actions.save}
      </button>
    </form>
  )
}
