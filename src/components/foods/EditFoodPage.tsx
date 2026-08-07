import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useMessages } from '../../lib/i18n'
import { FoodForm } from './FoodForm'
import type { FoodNav } from './foodNav'

export interface EditFoodPageProps {
  foodId: string
  nav: FoodNav
}

/** Editing a Catalog food, whole. Shared by both edit routes. */
export function EditFoodPage({ foodId, nav }: EditFoodPageProps) {
  const food = useQuery(api.foods.get, { id: foodId as Id<'foods'> })
  const update = useMutation(api.foods.update)
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messages = useMessages()
  const { detail, edit, form } = messages.foods

  if (food === undefined)
    return (
      <p className="text-sm opacity-60">{messages.common.errors.loading}</p>
    )
  if (food === null)
    return <p className="text-sm opacity-60">{detail.notFound}</p>

  // Reachable by typing the URL even though the detail page hides the link.
  // `foods.update` refuses too — this only avoids offering a form that is
  // guaranteed to fail on submit.
  if (food.seedKey !== undefined) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-4 text-2xl font-semibold">{food.name}</h1>
        <p className="text-sm opacity-60">
          {edit.builtInBefore}{' '}
          {/* Through the Group in the address rather than the flat `/foods/new`
              this arrived as: that route is gone (ADR-0002), and linking to it
              would drop the reader out of the Group they were browsing. */}
          <Link {...nav.create()} className="underline">
            {detail.createYourOwn}
          </Link>{' '}
          {edit.builtInAfter}
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">{edit.title}</h1>
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
          nutritionPer100: food.nutritionPer100,
          servings: food.servings,
        }}
        onSubmit={async (values) => {
          setSubmitting(true)
          setError(null)
          try {
            await update({ id: food._id, ...values })
            navigate(nav.detail(foodId))
          } catch (err) {
            setError(
              err instanceof ConvexError
                ? typeof err.data === 'string'
                  ? err.data
                  : form.saveFailed
                : err instanceof Error
                  ? err.message
                  : form.saveFailed,
            )
            setSubmitting(false)
          }
        }}
      />
    </div>
  )
}
