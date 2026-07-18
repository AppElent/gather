import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { MealName } from '../../../convex/lib/consumption'
import { NutrientInputGrid } from './NutrientInputGrid'
import {
  inputClass,
  nutrientInputsToFacts,
  toNutrientInputs,
} from './nutrientInputs'

interface Props {
  date: string
  meal: MealName
  onAdded: () => void
}

export function QuickAddTab({ date, meal, onAdded }: Props) {
  const [label, setLabel] = useState('')
  const [inputs, setInputs] = useState(() => toNutrientInputs())
  const [submitting, setSubmitting] = useState(false)
  const create = useMutation(api.consumption.create)

  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!label.trim()) return
        setSubmitting(true)
        await create({
          date,
          meal,
          label: label.trim(),
          quantity: 1,
          quantityUnit: 'piece',
          nutrition: nutrientInputsToFacts(inputs),
        })
        setSubmitting(false)
        onAdded()
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Label</span>
        <input
          className={inputClass}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder='e.g. "Restaurant meal"'
          required
        />
      </label>
      <NutrientInputGrid
        values={inputs}
        onChange={(key, value) =>
          setInputs((prev) => ({ ...prev, [key]: value }))
        }
      />
      <button
        type="submit"
        disabled={submitting}
        className="w-fit rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-4 py-2 text-sm font-semibold text-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Adding…' : 'Add'}
      </button>
    </form>
  )
}
