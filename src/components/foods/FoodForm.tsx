import type { NutritionFacts, NutritionSource } from '@gather/core/domain'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { parseServingAmount, type Serving } from '../../../convex/lib/servings'
import { errorMessage } from '../../lib/errorMessage'
import { fmt, useMessages } from '../../lib/i18n'
import { inputClass } from '../kitchen/fields'
import { NutrientInputGrid } from '../kitchen/NutrientInputGrid'
import { useNutritionInputs } from '../kitchen/useNutritionInputs'
import type { FoodRead } from './foodLookup'
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
   * `null` when there is none, which is what a cleared icon submits — never
   * `''`, which would sit in front of the generic glyph in the tile's fallback
   * chain and render nothing, and never absent, because Convex drops an
   * `undefined` argument before it arrives and the mutation would read that as
   * "say nothing about the icon" rather than "take it off".
   */
  icon?: string | null
  /**
   * Where the figures in this form came from, as the form last knew it —
   * prefilled by a lookup, or `manual` from the moment somebody types over a
   * nutrient (`useNutritionInputs`, shared with `RecipeForm`).
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
    const amount = parseServingAmount(row.amount)
    if (!label || amount === undefined) continue
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
  // `null` on the way in means the same as absent — no icon. The distinction
  // only matters on the way out, where it is what clears one.
  const [icon, setIcon] = useState(initial?.icon ?? undefined)
  const nutrition = useNutritionInputs(
    initial?.nutritionPer100,
    initial?.nutritionSource,
  )
  const [servingRows, setServingRows] = useState(() =>
    toServingRows(initial?.servings),
  )
  const messages = useMessages()
  const { form } = messages.foods

  return (
    <form
      className="mx-auto grid max-w-2xl gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        const servings = fromServingRows(servingRows)
        onSubmit({
          name: name.trim(),
          brand: brand.trim() || undefined,
          barcode: barcode || undefined,
          baseUnit,
          // Always stated, never omitted: this form is the whole truth about
          // the food, so "no icon" has to travel as `null` and actually clear.
          icon: icon ?? null,
          nutritionPer100: nutrition.facts,
          servings: servings.length > 0 ? servings : undefined,
          nutritionSource: nutrition.savedSource,
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
        {/* For the figures on screen now, not the ones the form opened with:
            an Open Food Facts product with no nutriments arrives as
            `imported` over an empty grid, which would read "these figures
            came from Imported" above nothing. */}
        {nutrition.shownSource && (
          <p className="mb-2 text-xs opacity-60">
            {fmt(form.nutritionSourceNote, {
              source: messages.nutrients.sources[nutrition.shownSource],
            })}
          </p>
        )}
        <NutrientInputGrid
          values={nutrition.inputs}
          onChange={nutrition.type}
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

/**
 * Editing a food somebody already has, whole: the form filled from the row,
 * the save, and the refusal if one comes back. The Foods edit page and the add
 * sheet's card both edit through this.
 */
export function EditFoodForm({
  food,
  onSaved,
}: {
  food: Pick<
    FoodRead,
    | '_id'
    | 'name'
    | 'brand'
    | 'barcode'
    | 'baseUnit'
    | 'icon'
    | 'nutritionPer100'
    | 'servings'
    | 'nutritionSource'
  >
  onSaved: () => void
}) {
  const update = useMutation(api.foods.update)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { form } = useMessages().foods

  return (
    <>
      {error && (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <FoodForm
        key={food._id}
        submitting={submitting}
        initial={{
          name: food.name,
          brand: food.brand,
          barcode: food.barcode,
          baseUnit: food.baseUnit,
          icon: food.icon,
          nutritionPer100: food.nutritionPer100,
          servings: food.servings,
          nutritionSource: food.nutritionSource,
        }}
        onSubmit={async ({
          // Shown while editing, never sent: `foods.update` works this out
          // from the figures themselves, so an edit cannot save one answer
          // while changing the numbers behind it.
          nutritionSource: _decidedByTheServer,
          ...values
        }) => {
          setSubmitting(true)
          setError(null)
          try {
            await update({ id: food._id, ...values })
            onSaved()
          } catch (err) {
            setError(errorMessage(err, form.saveFailed))
          } finally {
            setSubmitting(false)
          }
        }}
      />
    </>
  )
}
