import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { FoodForm } from '../../../components/foods/FoodForm'

export const Route = createFileRoute('/_app/foods/$foodId/edit')({
  component: EditFood,
})

function EditFood() {
  const { foodId } = Route.useParams()
  const food = useQuery(api.foods.get, { id: foodId as Id<'foods'> })
  const update = useMutation(api.foods.update)
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (food === undefined) return <p className="text-sm opacity-60">Loading…</p>
  if (food === null)
    return <p className="text-sm opacity-60">Food not found.</p>

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">Edit food</h1>
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
          servingSize: food.servingSize,
          servingLabel: food.servingLabel,
        }}
        onSubmit={async (values) => {
          setSubmitting(true)
          setError(null)
          try {
            await update({ id: food._id, ...values })
            navigate({ to: '/foods/$foodId', params: { foodId } })
          } catch (err) {
            setError(
              err instanceof ConvexError
                ? typeof err.data === 'string'
                  ? err.data
                  : 'Could not save food'
                : err instanceof Error
                  ? err.message
                  : 'Could not save food',
            )
            setSubmitting(false)
          }
        }}
      />
    </div>
  )
}
