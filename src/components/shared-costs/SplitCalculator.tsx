import type { SplitMode } from '@gather/core/finance'
import { Plus, X } from 'lucide-react'
import { type RefObject, useId } from 'react'
import { fmt, useI18n } from '../../lib/i18n'
import { inputClass } from '../recipes/fields'
import { PersonPills } from './PersonPills'
import { captionClass, GroundList, GroundRow, useMoney } from './parts'
import {
  customFrom,
  type Outcome,
  type Person,
  type SplitDraft,
} from './splitDraft'

/** The card the figures are typed into: what for, who paid, divided how. */
export function SplitCalculator({
  draft,
  onChange,
  people,
  outcome,
  onAddPayment,
  whatRef,
}: {
  draft: SplitDraft
  onChange: (next: SplitDraft) => void
  people: readonly Person[]
  outcome: Outcome
  onAddPayment: () => void
  whatRef: RefObject<HTMLInputElement | null>
}) {
  const { locale, messages } = useI18n()
  const { errors, split: words } = messages.finances
  const money = useMoney()
  const errorId = useId()
  const { participantIds, result, balances } = outcome
  const nameOf = (id: string) =>
    people.find((person) => person.id === id)?.name ?? ''

  function toggle(id: string) {
    const without = participantIds.filter((each) => each !== id)
    // Somebody has to be left to divide it between.
    if (without.length === 0) return
    onChange({
      ...draft,
      participantIds:
        without.length === participantIds.length ? [...without, id] : without,
    })
  }

  function setMode(mode: SplitMode) {
    if (mode === draft.mode) return
    onChange({
      ...draft,
      mode,
      customAmounts:
        mode === 'custom' ? customFrom(result, locale) : draft.customAmounts,
    })
  }

  return (
    <section className="grid gap-4 rounded-[var(--radius-card)] bg-[var(--surface)] p-4">
      <label className={`grid gap-1.5 ${captionClass}`}>
        {words.what}
        <input
          ref={whatRef}
          value={draft.what}
          onChange={(event) => onChange({ ...draft, what: event.target.value })}
          placeholder={words.whatPlaceholder}
          autoComplete="off"
          className="min-h-11 w-full rounded-[var(--radius-control)] border border-transparent bg-[var(--ground)] px-3 text-body font-normal text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--ink)] focus:ring-1 focus:ring-[var(--ink)]"
        />
      </label>

      <div className="grid gap-1.5">
        <h2 className={captionClass}>{words.whoPaid}</h2>
        {draft.payments.length > 0 ? (
          <GroundList label={words.whoPaid}>
            {draft.payments.map((payment) => {
              const name = nameOf(payment.personId)
              const amount = money(payment.amountCents)
              const remove = fmt(words.web.removePayment, { amount, name })
              return (
                <GroundRow
                  key={payment.key}
                  coin
                  name={name}
                  footnote={payment.label}
                  value={amount}
                >
                  <button
                    type="button"
                    aria-label={remove}
                    title={remove}
                    onClick={() =>
                      onChange({
                        ...draft,
                        payments: draft.payments.filter(
                          (each) => each.key !== payment.key,
                        ),
                      })
                    }
                    className="-mr-2 grid size-9 pointer-coarse:size-[var(--size-control-min)] shrink-0 place-items-center rounded-[var(--radius-pill)] text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </GroundRow>
              )
            })}
          </GroundList>
        ) : null}
        <button
          type="button"
          onClick={onAddPayment}
          className="inline-flex min-h-[var(--size-control-min)] items-center gap-1.5 justify-self-start rounded-[var(--radius-control)] px-1 text-subhead font-semibold text-[var(--accent-text)]"
        >
          <Plus className="size-4" strokeWidth={2.4} aria-hidden="true" />
          {words.addPayment}
        </button>
      </div>

      {draft.payments.length > 0 ? (
        <div className="grid gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className={captionClass}>{words.splitBetween}</h2>
            <div className="flex rounded-[var(--radius-pill)] bg-[var(--surface-2)] p-0.5">
              {(['equal', 'custom'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={draft.mode === mode}
                  onClick={() => setMode(mode)}
                  className={`min-h-8 pointer-coarse:min-h-10 rounded-[var(--radius-pill)] px-3 text-footnote font-semibold ${
                    draft.mode === mode
                      ? 'bg-[var(--surface)] text-[var(--ink)]'
                      : 'text-[var(--muted)]'
                  }`}
                >
                  {mode === 'equal' ? words.equally : words.custom}
                </button>
              ))}
            </div>
          </div>
          <PersonPills
            label={words.splitBetween}
            people={people}
            selected={participantIds}
            onPress={toggle}
          />
          {draft.mode === 'custom' ? (
            <GroundList label={words.web.eachPays}>
              {participantIds.map((id) => (
                <GroundRow key={id} coin name={nameOf(id)}>
                  <input
                    value={draft.customAmounts[id] ?? '0'}
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        customAmounts: {
                          ...draft.customAmounts,
                          [id]: event.target.value,
                        },
                      })
                    }
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label={fmt(words.web.amountOf, { name: nameOf(id) })}
                    aria-invalid={!balances}
                    aria-describedby={balances ? undefined : errorId}
                    className={`${inputClass} !w-28 min-h-10 shrink-0 text-right tabular-nums`}
                  />
                </GroundRow>
              ))}
            </GroundList>
          ) : null}
          {balances ? null : (
            <p
              id={errorId}
              role="status"
              className="m-0 text-footnote font-semibold text-[var(--danger)]"
            >
              {errors.customTotal}
            </p>
          )}
        </div>
      ) : null}
    </section>
  )
}
