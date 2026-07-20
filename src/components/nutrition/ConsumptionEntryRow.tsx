import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import type { MealName } from '../../../convex/lib/consumption'
import { MEAL_LABELS, MEAL_NAMES } from '../../../convex/lib/consumption'
import type { NutritionFacts } from '../../../convex/lib/nutrition'

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
}

interface Props {
  entry: ConsumptionEntryData
  onUpdate: (changes: {
    quantity: number
    meal: MealName
    date: string
  }) => Promise<void>
  onDelete: () => void
}

export function ConsumptionEntryRow({ entry, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [quantityInput, setQuantityInput] = useState(String(entry.quantity))
  const [meal, setMeal] = useState<MealName>(entry.meal)
  const [date, setDate] = useState(entry.date)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <li className="py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="font-medium">{entry.label}</span>
          <span className="ml-2 opacity-60">
            {entry.quantity} {entry.quantityUnit}
            {entry.nutrition.calories !== undefined &&
              ` · ${entry.nutrition.calories} kcal`}
          </span>
          {entry.recipeId && (
            <a
              href={`/recipes/${entry.recipeId}`}
              className="ml-2 text-xs underline"
            >
              View recipe
            </a>
          )}
          {entry.foodId && (
            <Link
              to="/foods/$foodId"
              params={{ foodId: entry.foodId }}
              className="ml-2 text-xs underline"
            >
              View food
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="text-xs underline"
          >
            {editing ? 'Close' : 'Edit'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-red-700"
          >
            Delete
          </button>
        </div>
      </div>
      {editing && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="text-xs">
            Qty
            <input
              inputMode="decimal"
              value={quantityInput}
              onChange={(e) => setQuantityInput(e.target.value)}
              disabled={saving}
              className="ml-1 w-16 rounded border border-[var(--app-border)] px-1 py-0.5"
            />
          </label>
          <label className="text-xs">
            Meal
            <select
              value={meal}
              onChange={(e) => setMeal(e.target.value as MealName)}
              disabled={saving}
              className="ml-1 rounded border border-[var(--app-border)] px-1 py-0.5"
            >
              {MEAL_NAMES.map((m) => (
                <option key={m} value={m}>
                  {MEAL_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Date
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
                  err instanceof Error ? err.message : 'Could not save changes',
                )
              } finally {
                setSaving(false)
              }
            }}
            className="rounded border border-[var(--app-fg)] bg-[var(--app-fg)] px-2 py-0.5 text-xs font-semibold text-[var(--app-surface)] disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
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
