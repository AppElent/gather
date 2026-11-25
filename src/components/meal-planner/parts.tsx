import { Clock, Minus, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { fmt, useMessages } from '../../lib/i18n'
import { buttonClass } from '../app/buttons'
import { RowThumb } from '../app/InsetList'
import { ModuleTile } from '../app/ModuleTile'

/** A small heading over a block of controls. */
export const labelClass = 'm-0 text-footnote font-semibold text-[var(--muted)]'

/** A toggle pill: `ink` when on, so its state is never colour alone. */
export function Chip({
  label,
  on,
  disabled,
  onClick,
  ariaLabel,
}: {
  label: ReactNode
  on: boolean
  disabled?: boolean
  onClick: () => void
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-9 rounded-[var(--radius-pill)] border px-3.5 text-subhead disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:min-h-[var(--size-control-min)] ${
        on
          ? 'border-[var(--ink)] bg-[var(--ink)] font-semibold text-[var(--surface)]'
          : 'border-[var(--hair-strong)] bg-[var(--surface)] text-[var(--ink)]'
      }`}
    >
      {label}
    </button>
  )
}

/** Minus, the value, plus. */
export function Stepper({
  label,
  value,
  less,
  more,
  canLess,
  canMore,
  onLess,
  onMore,
}: {
  label: string
  value: ReactNode
  less: string
  more: string
  canLess: boolean
  canMore: boolean
  onLess: () => void
  onMore: () => void
}) {
  const round =
    'grid size-9 shrink-0 place-items-center rounded-[var(--radius-pill)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-40 pointer-coarse:size-[var(--size-control-min)]'
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--ground)] p-1"
    >
      <button
        type="button"
        aria-label={less}
        disabled={!canLess}
        onClick={onLess}
        className={round}
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <span
        aria-live="polite"
        className="min-w-7 px-1 text-center text-body font-semibold tabular-nums"
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={more}
        disabled={!canMore}
        onClick={onMore}
        className={round}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

/** One of seven cells, Monday first: its short name and a word under it. */
export function DayCell({
  short,
  state,
  on,
  locked,
  disabled = locked,
  label,
  onClick,
}: {
  short: string
  state?: string
  on: boolean
  /** Not a choice: already planned, or nothing planned. */
  locked: boolean
  disabled?: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`grid min-h-9 min-w-0 content-center justify-items-center rounded-[var(--radius-control)] px-0 py-1 text-footnote font-semibold pointer-coarse:min-h-[var(--size-control-min)] ${
        locked
          ? 'bg-[var(--surface-2)] text-[var(--muted)]'
          : on
            ? 'bg-[var(--ink)] text-[var(--surface)]'
            : 'bg-[var(--ground)] text-[var(--ink)]'
      }`}
    >
      <span>{short}</span>
      {state ? (
        <span className="max-w-full truncate text-[10px] font-normal tracking-tight sm:text-[11px] sm:tracking-normal">
          {state}
        </span>
      ) : null}
    </button>
  )
}

/** A meal's photo, or the kitchen's tile: never a placeholder picture. */
export function MealThumb({
  imageUrl,
  quick,
}: {
  imageUrl?: string | null
  quick: boolean
}) {
  return (
    <RowThumb
      src={imageUrl}
      fallback={
        <ModuleTile
          group="kitchen"
          icon={quick ? 'Utensils' : 'ChefHat'}
          size="m"
        />
      }
    />
  )
}

/**
 * The Limit card: the day's smart actions are used, and choosing yourself
 * still works. Plan my week and Something else share it.
 */
export function LimitCard({
  used,
  limit,
  onChooseYourself,
}: {
  used: number
  limit: number
  onChooseYourself: () => void
}) {
  const plan = useMessages().mealPlanner.plan
  return (
    <div
      role="alert"
      className="grid gap-2 rounded-[var(--radius-control)] bg-[var(--ground)] p-4"
    >
      <p className="m-0 flex items-center gap-2 text-body font-semibold">
        <Clock className="size-5" aria-hidden="true" />
        {plan.limitTitle}
      </p>
      <p className="m-0 text-subhead">{fmt(plan.limitBody, { used, limit })}</p>
      <p className="m-0 text-footnote text-[var(--muted)]">{plan.limitHint}</p>
      <div>
        <button
          type="button"
          onClick={onChooseYourself}
          className={buttonClass.primary}
        >
          {plan.chooseYourself}
        </button>
      </div>
    </div>
  )
}
