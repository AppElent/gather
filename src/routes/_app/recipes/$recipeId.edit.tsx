import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { RecipeForm } from '../../../components/recipes/RecipeForm'

export const Route = createFileRoute('/_app/recipes/$recipeId/edit')({
  component: EditRecipe,
})

function EditRecipe() {
  const { recipeId } = Route.useParams()
  const recipe = useQuery(api.recipes.get, { id: recipeId as Id<'recipes'> })
  const update = useMutation(api.recipes.update)
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  if (recipe === undefined) return <p className="text-sm opacity-60">Loading…</p>
  if (recipe === null) return <p className="text-sm opacity-60">Recipe not found.</p>

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Edit recipe</h1>
      <RecipeForm
        submitting={submitting}
        initial={{
          title: recipe.title,
          description: recipe.description,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          tags: recipe.tags,
          rating: recipe.rating,
          prepMinutes: recipe.prepMinutes,
        }}
        onSubmit={async (values) => {
          setSubmitting(true)
          await update({ id: recipe._id, ...values })
          navigate({ to: '/recipes/$recipeId', params: { recipeId } })
        }}
      />
    </div>
  )
}
