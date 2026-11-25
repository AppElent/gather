import { parseCents } from '@gather/core/finance'
import { type FormEvent, useId, useRef, useState } from 'react'
import { useMessages } from '../../lib/i18n'
import { buttonClass } from '../app/buttons'
import { Dialog } from '../app/Dialog'
import { inputClass } from '../recipes/fields'
import { PersonPills } from './PersonPills'
import type { DraftPayment, Person } from './splitDraft'

/** "Add a payment": who, how much, and what for. Nothing is stored. */
export function PaymentDialog({
  people,
  onAdd,
  onClose,
}: {
  people: readonly Person[]
  onAdd: (payment: Omit<DraftPayment, 'key'>) => void
  onClose: () => void
}) {
  const { finances } = useMessages()
  const words = finances.split
  const formId = useId()
  const amountRef = useRef<HTMLInputElement>(null)
  const [personId, setPersonId] = useState(people[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const cents = parseCents(amount)
    if (cents === null || cents <= 0) {
      setError(cents === null ? finances.errors.amount : finances.errors.positive)
      amountRef.current?.focus()
      return
    }
    if (!personId) return
    onAdd({
      personId,
      amountCents: cents,
      label: label.trim() || undefined,
    })
  }

  return (
    <Dialog
      title={words.addPayment}
      onClose={onClose}
      initialFocus={amountRef}
      actions={
        <>
          <button
            type="button"
            onClick={onClose}
            className={buttonClass.secondary}
          >
            {finances.actions.cancel}
          </button>
          <button type="submit" form={formId} className={buttonClass.primary}>
            {finances.actions.add}
          </button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="grid gap-3.5">
        <PersonPills
          label={words.web.payer}
          people={people}
          selected={[personId]}
          onPress={setPersonId}
        />
        <label className="grid gap-1 text-footnote text-[var(--muted)]">
          {finances.recurringCosts.cost.amount}
          <input
            ref={amountRef}
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value)
              setError(null)
            }}
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={error !== null}
            aria-describedby={error ? `${formId}-error` : undefined}
            className={`${inputClass} min-h-11 text-[var(--ink)]`}
          />
        </label>
        {error ? (
          <p
            id={`${formId}-error`}
            role="alert"
            className="m-0 -mt-2 text-footnote font-semibold text-[var(--danger)]"
          >
            {error}
          </p>
        ) : null}
        <label className="grid gap-1 text-footnote text-[var(--muted)]">
          {words.paymentFor}
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            autoComplete="off"
            className={`${inputClass} min-h-11 text-[var(--ink)]`}
          />
        </label>
      </form>
    </Dialog>
  )
}
