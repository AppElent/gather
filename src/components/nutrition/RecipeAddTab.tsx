import { Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import {
  computeRecipeEntryNutrition,
  type MealName,
} from '../../../convex/lib/consumption'

interface Props {
  date: string
  meal: MealName
  onAdded: () => void
}

export function RecipeAddTab({ date, meal, onAdded }: Props) {
  const recipes = useQuery(api.recipes.list)
  const create = useMutation(api.consumption.create)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (recipes === undefined)
    return <p className="text-sm opacity-60">Loading…</p>

  const withNutrition = recipes.filter((r) => r.nutrition)
  const withoutNutrition = recipes.filter((r) => !r.nutrition)

  return (
    <div className="grid gap-2">
      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {withNutrition.length === 0 && (
        <p className="text-sm opacity-60">
          No recipes with nutrition data yet.
        </p>
      )}
      {withNutrition.map((recipe) => {
        const quantityInput = quantities[recipe._id] ?? '1'
        return (
          <div
            key={recipe._id}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span>{recipe.title}</span>
            <div className="flex items-center gap-1">
              <input
                inputMode="decimal"
                value={quantityInput}
                onChange={(e) =>
                  setQuantities((prev) => ({
                    ...prev,
                    [recipe._id]: e.target.value,
                  }))
                }
                className="w-14 rounded border border-[var(--app-border)] px-1 py-0.5"
              />
              <span className="opacity-60">servings</span>
              <button
                type="button"
                disabled={submittingId === recipe._id}
                onClick={async () => {
                  const quantity = Number(quantityInput.replace(',', '.'))
                  if (
                    !Number.isFinite(quantity) ||
                    quantity <= 0 ||
                    !recipe.nutrition
                  )
                    return
                  setSubmittingId(recipe._id)
                  setError(null)
                  try {
                    await create({
                      date,
                      meal,
                      recipeId: recipe._id,
                      label: recipe.title,
                      quantity,
                      quantityUnit: 'serving',
                      nutrition: computeRecipeEntryNutrition(
                        recipe.nutrition,
                        quantity,
                      ),
                    })
                    onAdded()
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : 'Could not log this recipe',
                    )
                  } finally {
                    setSubmittingId(null)
                  }
                }}
                className="rounded border border-[var(--app-fg)] bg-[var(--app-fg)] px-2 py-0.5 text-xs font-semibold text-[var(--app-surface)] disabled:opacity-60"
              >
                Add
              </button>
            </div>
          </div>
        )
      })}
      {withoutNutrition.length > 0 && (
        <div className="mt-2 border-t border-[var(--app-border)] pt-2">
          <p className="mb-1 text-xs opacity-60">
            These recipes have no nutrition data yet:
          </p>
          {withoutNutrition.map((recipe) => (
            <Link
              key={recipe._id}
              to="/recipes/$recipeId"
              params={{ recipeId: recipe._id }}
              className="block text-xs underline"
            >
              {recipe.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
