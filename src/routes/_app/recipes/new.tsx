import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import { RecipeForm } from '../../../components/recipes/RecipeForm'

export const Route = createFileRoute('/_app/recipes/new')({
  component: NewRecipe,
})

function NewRecipe() {
  const create = useMutation(api.recipes.create)
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">New recipe</h1>
      {error && (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <RecipeForm
        submitting={submitting}
        onSubmit={async (values) => {
          setSubmitting(true)
          setError(null)
          try {
            const id = await create(values)
            navigate({ to: '/recipes/$recipeId', params: { recipeId: id } })
          } catch (err) {
            setError(
              err instanceof Error ? err.message : 'Could not save recipe',
            )
            setSubmitting(false)
          }
        }}
      />
    </div>
  )
}
