import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import type { MealName } from '../../../convex/lib/consumption'
import { MEAL_NAMES } from '../../../convex/lib/consumption'
import type { NutritionFacts } from '../../../convex/lib/nutrition'
import { fmt, useMessages } from '../../lib/i18n'
import type { NutritionNav } from './nutritionNav'

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
  }) => Promise<void>
  onDelete: () => void
}

export function ConsumptionEntryRow({
  entry,
  nav,
  selection,
  onUpdate,
  onDelete,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [quantityInput, setQuantityInput] = useState(String(entry.quantity))
  const [meal, setMeal] = useState<MealName>(entry.meal)
  const [date, setDate] = useState(entry.date)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messages = useMessages()
  const { diary, meals, units } = messages.nutrition

  return (
    <li className="py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          {selection && (
            <input
              type="checkbox"
              checked={selection.selected}
              onChange={(e) => selection.onChange(e.target.checked)}
              aria-label={fmt(diary.combos.selectEntry, { label: entry.label })}
              className="mr-2 h-5 w-5 align-middle accent-[var(--app-fg)]"
            />
          )}
          {/* Decoration, and marked as such: the label beside it already says
              what this is, so a screen reader repeating the emoji's name would
              only be reading the row twice. */}
          {entry.icon && (
            <span aria-hidden="true" className="mr-1.5">
              {entry.icon}
            </span>
          )}
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
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
          <label className="text-xs">
            {diary.entry.quantity}
            <input
              inputMode="decimal"
              value={quantityInput}
              onChange={(e) => setQuantityInput(e.target.value)}
              disabled={saving}
              className="ml-1 w-16 rounded border border-[var(--app-border)] px-1 py-0.5"
            />
          </label>
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
              const quantity = Number(quantityInput.replace(',', '.'))
              if (!Number.isFinite(quantity) || quantity <= 0) return
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
