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
import { useMessages } from '../../lib/i18n'
import { FoodThumbnail, type ThumbnailKind } from './FoodThumbnail'
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
}

interface Props {
  entry: ConsumptionEntryData
  nav: NutritionNav
  onUpdate: (changes: {
    quantity: number
    meal: MealName
    date: string
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
 * Two entries get the plain field instead, for the same reason: their number is
 * not a base-unit amount that the chips could replace. A food that has gone has
 * nothing to offer at all, and an entry counted in the food's *portions*
 * ('piece') is counting something else.
 */
function FoodEntryAmount({
  entry,
  disabled,
  onAmount,
}: {
  entry: ConsumptionEntryData & { foodId: string }
  disabled: boolean
  onAmount: (amount: number | undefined) => void
}) {
  const { add } = useMessages().nutrition.diary
  const foodId = entry.foodId as Id<'foods'>
  const food = useQuery(api.foods.get, { id: foodId })
  const loggedAmounts = useQuery(api.consumption.loggedAmountsForFood, {
    foodId,
  })
  const [selection, setSelection] = useState<ServingSelection | null>(null)

  // In flight. Nothing is shown rather than a field that would be replaced by
  // chips a moment later; the row still saves the amount the entry already has.
  if (food === undefined) return null

  if (!food || entry.quantityUnit !== food.baseUnit) {
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
  const current = selection ?? selectionForAmount(offered, entry.quantity)

  return (
    <div className="w-full">
      <span className="mb-1 block text-xs">{add.amount}</span>
      <ServingPicker
        baseUnit={food.baseUnit}
        offered={offered}
        selection={current}
        onSelect={(next) => {
          setSelection(next)
          const choice = toChoice(offered, next)
          onAmount(choice ? resolveAmount(food, choice)?.amount : undefined)
        }}
      />
    </div>
  )
}

export function ConsumptionEntryRow({ entry, nav, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  /**
   * What saving would write, in the unit the entry counts. Undefined means the
   * amount on show does not resolve to one — an empty field, a typed word —
   * and saving does nothing, which is what it always did.
   */
  const [amount, setAmount] = useState<number | undefined>(entry.quantity)
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
            <span className="ml-2 opacity-60">
              {entry.quantity} {units[entry.quantityUnit]}
              {entry.nutrition.calories !== undefined &&
                ` · ${entry.nutrition.calories} kcal`}
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
              onAmount={setAmount}
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
                await onUpdate({ quantity, meal, date })
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
