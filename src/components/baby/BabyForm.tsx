import { useState } from 'react'
import { useMessages } from '../../lib/i18n'

const inputClass =
  'w-full rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)] disabled:cursor-not-allowed disabled:opacity-60'

export interface BabyFormValues {
  name: string
  birthDate: string
  sex?: 'female' | 'male' | 'unspecified'
}

interface BabyFormProps {
  initial?: BabyFormValues
  submitting: boolean
  onSubmit: (values: BabyFormValues) => void
}

export function BabyForm({ initial, submitting, onSubmit }: BabyFormProps) {
  const messages = useMessages()
  const { form } = messages.baby.log

  const [name, setName] = useState(initial?.name ?? '')
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? '')
  const [sex, setSex] = useState(initial?.sex ?? 'unspecified')

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ name: name.trim(), birthDate, sex })
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
