import { useNavigate } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { ImageUploadField } from '../app/ImageUploadField'
import { RecipeForm } from './RecipeForm'
import type { RecipeNav } from './recipeNav'

type RecipeDetail = Doc<'recipes'> & { imageUrl: string | null }

export interface EditRecipePageProps {
  recipeId: string
  nav: RecipeNav
}

/** Editing a recipe, whole. Shared by the flat and Group-scoped edit routes. */
export function EditRecipePage({ recipeId, nav }: EditRecipePageProps) {
  const recipe = useQuery(api.recipes.get, { id: recipeId as Id<'recipes'> })

  if (recipe === undefined)
    return <p className="text-sm opacity-60">Loading…</p>
  if (recipe === null)
    return <p className="text-sm opacity-60">Recipe not found.</p>

  return <EditRecipeForm key={recipe._id} recipe={recipe} nav={nav} />
}

function EditRecipeForm({
  recipe,
  nav,
}: {
  recipe: RecipeDetail
  nav: RecipeNav
}) {
  const update = useMutation(api.recipes.update)
  const generateUploadUrl = useMutation(api.recipes.generateUploadUrl)
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
        generateUploadUrl={generateUploadUrl}
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
            navigate(nav.detail(recipe._id))
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
