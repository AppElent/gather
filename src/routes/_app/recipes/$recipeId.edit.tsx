import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../convex/_generated/dataModel'
import { ImageUploadField } from '../../../components/recipes/ImageUploadField'
import { RecipeForm } from '../../../components/recipes/RecipeForm'

export const Route = createFileRoute('/_app/recipes/$recipeId/edit')({
  component: EditRecipe,
})

type RecipeDetail = Doc<'recipes'> & { imageUrl: string | null }

function EditRecipe() {
  const { recipeId } = Route.useParams()
  const recipe = useQuery(api.recipes.get, { id: recipeId as Id<'recipes'> })

  if (recipe === undefined)
    return <p className="text-sm opacity-60">Loading…</p>
  if (recipe === null)
    return <p className="text-sm opacity-60">Recipe not found.</p>

  return <EditRecipeForm key={recipe._id} recipe={recipe} />
}

function EditRecipeForm({ recipe }: { recipe: RecipeDetail }) {
  const update = useMutation(api.recipes.update)
  const aiConfigured = useQuery(api.recipes.aiConfigured)
  const estimateNutrition = useAction(api.recipeNutrition.estimateNutrition)
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageId, setImageId] = useState<Id<'_storage'> | undefined>(
    recipe.imageId,
  )
  const [imageUrl, setImageUrl] = useState<string | null>(recipe.imageUrl)

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Edit recipe</h1>
      {error && (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <ImageUploadField
        imageUrl={imageUrl}
        onChange={(id) => {
          setImageId(id)
          if (id === undefined) setImageUrl(null)
        }}
      />

      <RecipeForm
        submitting={submitting}
        initial={{
          title: recipe.title,
          description: recipe.description,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          tags: recipe.tags,
          rating: recipe.rating,
          servings: recipe.servings,
          nutrition: recipe.nutrition,
          nutritionSource: recipe.nutritionSource,
        }}
        onEstimate={
          aiConfigured ? (args) => estimateNutrition(args) : undefined
        }
        onSubmit={async (values) => {
          setSubmitting(true)
          setError(null)
          try {
            await update({
              id: recipe._id,
              ...values,
              rating: values.rating ?? null,
              imageId: imageId ?? null,
              servings: values.servings ?? null,
              nutrition: values.nutrition ?? null,
              nutritionSource: values.nutritionSource ?? null,
            })
            navigate({
              to: '/recipes/$recipeId',
              params: { recipeId: recipe._id },
            })
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
