import { useState } from 'react'
import type { NutritionFacts } from '../../../convex/lib/nutrition'
import { fmt, useMessages } from '../../lib/i18n'
import { NutrientInputGrid } from '../nutrition/NutrientInputGrid'
import {
  inputClass,
  nutrientInputsToFacts,
  parseDecimal,
  toNutrientInputs,
} from '../nutrition/nutrientInputs'

export interface FoodFormValues {
  name: string
  brand?: string
  barcode?: string
  baseUnit: 'g' | 'ml'
  nutritionPer100: NutritionFacts
  servingSize?: number
  servingLabel?: string
}

interface Props {
  initial?: Partial<FoodFormValues>
  submitting: boolean
  onSubmit: (values: FoodFormValues) => void
  /** e.g. "From Open Food Facts — review before saving." Shown above the form. */
  sourceNote?: string
}

export function FoodForm({ initial, submitting, onSubmit, sourceNote }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [brand, setBrand] = useState(initial?.brand ?? '')
  // Barcode is never user-editable in this form — it's set only via the
  // scan flow's URL param and is read-only display here (see /foods/new.tsx).
  const [barcode] = useState(initial?.barcode ?? '')
  const [baseUnit, setBaseUnit] = useState<'g' | 'ml'>(initial?.baseUnit ?? 'g')
  const [nutritionInputs, setNutritionInputs] = useState(() =>
    toNutrientInputs(initial?.nutritionPer100),
  )
  const [servingSize, setServingSize] = useState(
    initial?.servingSize !== undefined ? String(initial.servingSize) : '',
  )
  const [servingLabel, setServingLabel] = useState(initial?.servingLabel ?? '')
  const messages = useMessages()
  const { form } = messages.foods

  return (
    <form
      className="mx-auto grid max-w-2xl gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        const size = parseDecimal(servingSize)
        onSubmit({
          name: name.trim(),
          brand: brand.trim() || undefined,
          barcode: barcode || undefined,
          baseUnit,
          nutritionPer100: nutrientInputsToFacts(nutritionInputs),
          servingSize: size && size > 0 ? size : undefined,
          servingLabel: servingLabel.trim() || undefined,
        })
      }}
    >
      {sourceNote && (
        <p className="rounded-[var(--app-radius)] border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          {sourceNote}
        </p>
      )}
      {barcode && (
        <p className="text-xs opacity-60">{fmt(form.barcode, { barcode })}</p>
      )}
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
        <span className="mb-1 block font-medium">{form.brand}</span>
        <input
          className={inputClass}
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />
      </label>
      <fieldset className="rounded-[var(--app-radius)] border border-[var(--app-border)] p-3">
        <legend className="px-1 text-sm font-medium">{form.baseUnit}</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="baseUnit"
              checked={baseUnit === 'g'}
              onChange={() => setBaseUnit('g')}
            />
            {form.grams}
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="baseUnit"
              checked={baseUnit === 'ml'}
              onChange={() => setBaseUnit('ml')}
            />
            {form.milliliters}
          </label>
        </div>
      </fieldset>
      <fieldset className="rounded-[var(--app-radius)] border border-[var(--app-border)] p-3">
        <legend className="px-1 text-sm font-medium">
          {fmt(form.nutritionLegend, { unit: baseUnit })}
        </legend>
        <NutrientInputGrid
          values={nutritionInputs}
          onChange={(key, value) =>
            setNutritionInputs((prev) => ({ ...prev, [key]: value }))
          }
        />
      </fieldset>
      <label className="block max-w-32 text-sm">
        <span className="mb-1 block font-medium">
          {fmt(form.servingSize, { unit: baseUnit })}
        </span>
        <input
          inputMode="decimal"
          className={inputClass}
          value={servingSize}
          onChange={(e) => setServingSize(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{form.servingLabel}</span>
        <input
          className={inputClass}
          value={servingLabel}
          onChange={(e) => setServingLabel(e.target.value)}
          placeholder={form.servingLabelPlaceholder}
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="w-fit rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-4 py-2 text-sm font-semibold text-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? messages.common.actions.saving : form.save}
      </button>
    </form>
  )
}
