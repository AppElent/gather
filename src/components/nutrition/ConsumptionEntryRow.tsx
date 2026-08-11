import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { MealName } from '../../../convex/lib/consumption'
import { MEAL_NAMES } from '../../../convex/lib/consumption'
import type { NutritionFacts } from '../../../convex/lib/nutrition'
import {
  offeredServings,
  parseServingAmount,
  resolveAmount,
} from '../../../convex/lib/servings'
import { fmt, useMessages } from '../../lib/i18n'
import { FoodThumbnail, type ThumbnailKind } from './FoodThumbnail'
import { roundKcal } from './kcal'
import type { NutritionNav } from './nutritionNav'
import {
  ServingPicker,
  type ServingSelection,
  selectionForAmount,
  toChoice,
} from './ServingPicker'

export interface ConsumptionEntryData {
  _id: string
  label: string
  quantity: number
  quantityUnit: 'serving' | 'g' | 'ml' | 'piece'
  meal: MealName
  date: string
  nutrition: NutritionFacts
  recipeId?: string
  foodId?: string
  /**
   * The emoji a one-off was given (#94). Only a one-off carries one: an entry
   * with a food or a recipe behind it has something to read a picture from,
   * and does not keep a copy of the answer here.
   */
  icon?: string
  /** The current source picture, if a food or visible recipe still has one. */
  imageUrl?: string | null
  /** A food's current chosen icon; a one-off continues to use `icon`. */
  sourceIcon?: string
  /** The source type survives when its provenance link is no longer visible. */
  thumbnailKind?: ThumbnailKind
  /**
   * The Combo this row was logged by, named as it was at the time (#99).
   *
   * A snapshot, not a lookup: renaming the Combo does not rewrite the day,
   * and deleting it does not blank what it left behind.
   */
  comboLabel?: string
}

interface Props {
  entry: ConsumptionEntryData
  nav: NutritionNav
  /**
   * Whether this row is going into the Combo being saved (#99). Absent the
   * rest of the time: the diary is for reading, and a permanent column of
   * ticks would say otherwise.
   */
  selection?: { selected: boolean; onChange: (selected: boolean) => void }
  onUpdate: (changes: {
    quantity: number
    meal: MealName
    date: string
    /**
     * Sent only when re-choosing the amount moved the entry off the unit it
     * was counting in — a 'piece' entry answered with a base-unit chip (#102).
     */
    quantityUnit?: ConsumptionEntryData['quantityUnit']
  }) => Promise<void>
  onDelete: () => void
}

/**
 * The plain amount field: a number in whatever unit the entry already counts.
 *
 * It owns the text and reports only what that text *means*, because a half-typed
 * amount is not an amount — the same rule `ServingPicker`'s custom field
 * follows, so the row above can read one answer from either.
 */
function AmountField({
  initial,
  disabled,
  onAmount,
}: {
  initial: number
  disabled: boolean
  onAmount: (amount: number | undefined) => void
}) {
  const [text, setText] = useState(String(initial))
  const { entry } = useMessages().nutrition.diary

  return (
    <label className="text-xs">
      {entry.quantity}
      <input
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          onAmount(parseServingAmount(e.target.value))
        }}
        disabled={disabled}
        className="ml-1 w-16 rounded border border-[var(--app-border)] px-1 py-0.5"
      />
    </label>
  )
}

/**
 * How much of a food, edited the way it was logged (#102).
 *
 * The same three sources the add sheet offers — what the food declares, what
 * you have logged for it before, and an amount you type — resolved by the same
 * `resolveAmount`, so an edit and a log can never disagree about what "1 slice"
 * comes to. What leaves here is only ever the canonical amount in the food's
 * base unit: the entry keeps one quantity, and the nutrition that goes with it
 * is recomputed server-side from the food itself.
 *
 * An entry counted in the food's *portions* ('piece') is included, and that is
 * the case this feature was reported missing on (#102 review): the seeded diary
 * logs a banana as one piece, so the entries most people meet first were the
 * ones still getting a bare grams box. A piece is `quantity` lots of the food's
 * first named serving, which is an amount like any other — it is converted to
 * base units to find the chip it already sits on, and re-choosing moves the
 * entry onto the base unit rather than leaving a number whose meaning quietly
 * changed underneath it.
 *
 * The plain field remains for a food that has gone (nothing to offer at all)
 * and for a piece entry whose food declares no serving to count, where the
 * number does not convert to anything.
 */
function FoodEntryAmount({
  entry,
  disabled,
  onAmount,
}: {
  entry: ConsumptionEntryData & { foodId: string }
  disabled: boolean
  onAmount: (
    amount: number | undefined,
    unit?: ConsumptionEntryData['quantityUnit'],
  ) => void
}) {
  const { add } = useMessages().nutrition.diary
  const foodId = entry.foodId as Id<'foods'>
  const food = useQuery(api.foods.get, { id: foodId })
  const loggedAmounts = useQuery(api.consumption.loggedAmountsForFood, {
    foodId,
    // This row is what is being changed, not history to suggest back.
    excludeEntryId: entry._id as Id<'consumptionEntries'>,
  })
  const [selection, setSelection] = useState<ServingSelection | null>(null)

  // In flight. Nothing is shown rather than a field that would be replaced by
  // chips a moment later; the row still saves the amount the entry already has.
  if (food === undefined) return null

  // What the entry's number is worth in the food's base unit — itself when it
  // already counts those, and `portion` lots of the first serving when it
  // counts pieces.
  const portion = food?.servings?.[0]?.amount
  const baseAmount =
    food && entry.quantityUnit === food.baseUnit
      ? entry.quantity
      : entry.quantityUnit === 'piece' && portion
        ? Math.round(entry.quantity * portion * 100) / 100
        : undefined

  if (!food || baseAmount === undefined) {
    return (
      <AmountField
        initial={entry.quantity}
        disabled={disabled}
        onAmount={onAmount}
      />
    )
  }

  const offered = offeredServings(food, loggedAmounts ?? [])
  // Left derived until something is chosen, so the chips settle once your own
  // amounts arrive — the entry's amount may be one of them.
  const current = selection ?? selectionForAmount(offered, baseAmount)

  return (
    <div className="w-full">
      <span className="mb-1 block text-xs">{add.amount}</span>
      <ServingPicker
        baseUnit={food.baseUnit}
        offered={offered}
        selection={current}
        disabled={disabled}
        onSelect={(next) => {
          setSelection(next)
          const choice = toChoice(offered, next)
          // Always the food's base unit, which is the only thing the picker
          // can answer in. For a 'piece' entry that is a change of unit, and
          // the row has to pass it on or the number would be reread as a
          // count of portions.
          onAmount(
            choice ? resolveAmount(food, choice)?.amount : undefined,
            food.baseUnit,
          )
        }}
      />
    </div>
  )
}

export function ConsumptionEntryRow({
  entry,
  nav,
  selection,
  onUpdate,
  onDelete,
}: Props) {
  const [editing, setEditing] = useState(false)
  /**
   * What saving would write, in the unit the entry counts. Undefined means the
   * amount on show does not resolve to one — an empty field, a typed word —
   * and saving does nothing, which is what it always did.
   */
  const [amount, setAmount] = useState<number | undefined>(entry.quantity)
  /** Absent unless the amount on show is in a different unit than the entry. */
  const [unit, setUnit] = useState<
    ConsumptionEntryData['quantityUnit'] | undefined
  >(undefined)
  const [meal, setMeal] = useState<MealName>(entry.meal)
  const [date, setDate] = useState(entry.date)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messages = useMessages()
  const { diary, meals, units } = messages.nutrition

  return (
    <li className="py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {selection && (
            <input
              type="checkbox"
              checked={selection.selected}
              onChange={(e) => selection.onChange(e.target.checked)}
              aria-label={fmt(diary.combos.selectEntry, { label: entry.label })}
              className="h-5 w-5 shrink-0 accent-[var(--app-fg)]"
            />
          )}
          {/* Decoration: the label already names this row, so the tile must not
              make a screen reader announce the same thing twice. */}
          <span aria-hidden="true">
            <FoodThumbnail
              src={entry.imageUrl}
              icon={entry.sourceIcon ?? entry.icon}
              kind={entry.thumbnailKind ?? 'food'}
            />
          </span>
          <div className="min-w-0">
            <span className="font-medium">{entry.label}</span>
            {/* Where this row came from, when a Combo put it here (#99). The
                expansion is the entries it replaced, so without this the
                saving that just happened leaves no trace anybody can see. */}
            {entry.comboLabel && (
              <span
                title={fmt(diary.entry.fromCombo, { name: entry.comboLabel })}
                className="ml-2 rounded-full border border-[var(--app-border)] px-2 py-0.5 align-middle text-[11px] opacity-70"
              >
                {entry.comboLabel}
              </span>
            )}
            <span className="ml-2 opacity-60">
              {entry.quantity} {units[entry.quantityUnit]}
              {entry.nutrition.calories !== undefined &&
                ` · ${roundKcal(entry.nutrition.calories)} kcal`}
            </span>
            {entry.recipeId && (
              <Link
                {...nav.recipe(entry.recipeId)}
                className="ml-2 text-xs underline"
              >
                {diary.entry.viewRecipe}
              </Link>
            )}
            {entry.foodId && (
              <Link
                {...nav.food(entry.foodId)}
                className="ml-2 text-xs underline"
              >
                {diary.entry.viewFood}
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              // Opening the editor shows what the entry says, not what was
              // left behind the last time it was opened and abandoned.
              if (!editing) {
                setAmount(entry.quantity)
                setUnit(undefined)
                setMeal(entry.meal)
                setDate(entry.date)
                setError(null)
              }
              setEditing(!editing)
            }}
            className="text-xs underline"
          >
            {editing
              ? messages.common.actions.close
              : messages.common.actions.edit}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-red-700"
          >
            {messages.common.actions.delete}
          </button>
        </div>
      </div>
      {editing && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {entry.foodId ? (
            <FoodEntryAmount
              entry={{ ...entry, foodId: entry.foodId }}
              disabled={saving}
              onAmount={(next, nextUnit) => {
                setAmount(next)
                setUnit(nextUnit === entry.quantityUnit ? undefined : nextUnit)
              }}
            />
          ) : (
            <AmountField
              initial={entry.quantity}
              disabled={saving}
              onAmount={setAmount}
            />
          )}
          <label className="text-xs">
            {diary.entry.meal}
            <select
              value={meal}
              onChange={(e) => setMeal(e.target.value as MealName)}
              disabled={saving}
              className="ml-1 rounded border border-[var(--app-border)] px-1 py-0.5"
            >
              {MEAL_NAMES.map((m) => (
                <option key={m} value={m}>
                  {meals[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            {diary.entry.date}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={saving}
              className="ml-1 rounded border border-[var(--app-border)] px-1 py-0.5"
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              if (amount === undefined) return
              const quantity = amount
              setSaving(true)
              setError(null)
              try {
                await onUpdate({
                  quantity,
                  meal,
                  date,
                  ...(unit ? { quantityUnit: unit } : {}),
                })
                setEditing(false)
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : diary.entry.saveFailed,
                )
              } finally {
                setSaving(false)
              }
            }}
            className="rounded border border-[var(--app-fg)] bg-[var(--app-fg)] px-2 py-0.5 text-xs font-semibold text-[var(--app-surface)] disabled:opacity-60"
          >
            {saving
              ? messages.common.actions.saving
              : messages.common.actions.save}
          </button>
          {error && (
            <p className="w-full rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-800">
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  )
}
