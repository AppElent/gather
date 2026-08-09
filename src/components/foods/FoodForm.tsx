import { useState } from 'react'
import {
  hasNutritionFigures,
  type NutritionFacts,
  type NutritionSource,
} from '../../../convex/lib/nutrition'
import type { Serving } from '../../../convex/lib/servings'
import { fmt, useMessages } from '../../lib/i18n'
import { NutrientInputGrid } from '../nutrition/NutrientInputGrid'
import {
  inputClass,
  nutrientInputsToFacts,
  parseDecimal,
  toNutrientInputs,
} from '../nutrition/nutrientInputs'
import { IconPicker } from './IconPicker'

export interface FoodFormValues {
  name: string
  brand?: string
  barcode?: string
  baseUnit: 'g' | 'ml'
  nutritionPer100: NutritionFacts
  servings?: Serving[]
  /**
   * The emoji this food shows when there is no photograph of it (#94).
   *
   * Absent when there is none, and absent is what a cleared icon submits —
   * never `''`, which would sit in front of the generic glyph in the tile's
   * fallback chain and render nothing.
   */
  icon?: string
  /**
   * Where the figures in this form came from, as the form last knew it —
   * prefilled by a lookup, or `manual` from the moment somebody types over a
   * nutrient. Same vocabulary and same behaviour as `RecipeForm`.
   *
   * Only the paths that *create* a food read this off the form; `foods.update`
   * decides for itself by comparing the figures it is given with the ones on
   * the row, so an edit cannot claim to be an import.
   */
  nutritionSource?: NutritionSource
}

/** A serving being typed: both halves are text until they are read back. */
interface ServingRow {
  label: string
  amount: string
}

/**
 * The rows the form shows for a food's servings. Always one empty row to type
 * into, so adding the first serving is not itself a step.
 */
function toServingRows(servings?: Serving[]): ServingRow[] {
  return [
    ...(servings ?? []).map((serving) => ({
      label: serving.label,
      amount: String(serving.amount),
    })),
    { label: '', amount: '' },
  ]
}

/** Rows that name an amount somebody could actually eat; the rest are noise. */
function fromServingRows(rows: ServingRow[]): Serving[] {
  const servings: Serving[] = []
  for (const row of rows) {
    const label = row.label.trim()
    const amount = parseDecimal(row.amount)
    if (!label || amount === undefined || amount <= 0) continue
    servings.push({ label, amount })
  }
  return servings
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
  const [icon, setIcon] = useState(initial?.icon)
  const [nutritionInputs, setNutritionInputs] = useState(() =>
    toNutrientInputs(initial?.nutritionPer100),
  )
  const [nutritionSource, setNutritionSource] = useState<
    NutritionSource | undefined
  >(initial?.nutritionSource)
  const [servingRows, setServingRows] = useState(() =>
    toServingRows(initial?.servings),
  )
  const messages = useMessages()
  const { form } = messages.foods

  // The note answers for the figures on screen now, not for the answer the form
  // was opened with. An Open Food Facts product with no nutriments arrives as
  // `imported` over an empty grid, and clearing the last figure by hand leaves
  // the same mismatch — both would otherwise read "these figures came from
  // Imported" above nothing. This is the predicate the submit below already
  // applies, so what is shown and what is saved cannot disagree.
  const shownNutritionSource = hasNutritionFigures(
    nutrientInputsToFacts(nutritionInputs),
  )
    ? nutritionSource
    : undefined

  return (
    <form
      className="mx-auto grid max-w-2xl gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        const servings = fromServingRows(servingRows)
        const facts = nutrientInputsToFacts(nutritionInputs)
        onSubmit({
          name: name.trim(),
          brand: brand.trim() || undefined,
          barcode: barcode || undefined,
          baseUnit,
          icon,
          nutritionPer100: facts,
          servings: servings.length > 0 ? servings : undefined,
          // No figures, nothing to say about where they came from.
          nutritionSource: hasNutritionFigures(facts)
            ? (nutritionSource ?? 'manual')
            : undefined,
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
      {/* Above the figures, because it answers a different kind of question and
          a shorter one: what this *is*, rather than what is in it. It is also
          the field an Open Food Facts review most often has to fill in — their
          products carry a picture or they carry nothing (#94). */}
      <IconPicker value={icon} onChange={setIcon} disabled={submitting} />
      <fieldset className="rounded-[var(--app-radius)] border border-[var(--app-border)] p-3">
        <legend className="px-1 text-sm font-medium">
          {fmt(form.nutritionLegend, { unit: baseUnit })}
        </legend>
        {shownNutritionSource && (
          <p className="mb-2 text-xs opacity-60">
            {fmt(form.nutritionSourceNote, {
              source: messages.nutrients.sources[shownNutritionSource],
            })}
          </p>
        )}
        <NutrientInputGrid
          values={nutritionInputs}
          onChange={(key, value) => {
            setNutritionInputs((prev) => ({ ...prev, [key]: value }))
            // Typing over a figure makes the figures yours, so the note above
            // stops saying they came from somewhere else — the same thing
            // `foods.update` concludes independently when the save lands.
            setNutritionSource('manual')
          }}
        />
      </fieldset>
      <fieldset className="rounded-[var(--app-radius)] border border-[var(--app-border)] p-3">
        <legend className="px-1 text-sm font-medium">
          {form.servingsLegend}
        </legend>
        <p className="mb-2 text-xs opacity-60">
          {fmt(form.servingsHint, { unit: baseUnit })}
        </p>
        <div className="grid gap-2">
          {servingRows.map((row, index) => (
            // Keyed by position: a row has no identity of its own, it is a
            // place in a list somebody is typing into, and there is no
            // reordering for the index to go stale under.
            <div key={index} className="flex items-center gap-2">
              <input
                className={inputClass}
                value={row.label}
                aria-label={form.servingLabel}
                placeholder={form.servingLabelPlaceholder}
                onChange={(e) =>
                  setServingRows((rows) => {
                    const next = rows.map((r, i) =>
                      i === index ? { ...r, label: e.target.value } : r,
                    )
                    return index === rows.length - 1
                      ? [...next, { label: '', amount: '' }]
                      : next
                  })
                }
              />
              <input
                inputMode="decimal"
                className={`${inputClass} max-w-28`}
                value={row.amount}
                aria-label={fmt(form.servingAmount, { unit: baseUnit })}
                onChange={(e) =>
                  setServingRows((rows) =>
                    rows.map((r, i) =>
                      i === index ? { ...r, amount: e.target.value } : r,
                    ),
                  )
                }
              />
              <button
                type="button"
                aria-label={form.removeServing}
                onClick={() =>
                  setServingRows((rows) =>
                    rows.length === 1
                      ? [{ label: '', amount: '' }]
                      : rows.filter((_, i) => i !== index),
                  )
                }
                className="min-h-11 min-w-11 rounded-[var(--app-radius)] border border-[var(--app-border)]"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </fieldset>
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
