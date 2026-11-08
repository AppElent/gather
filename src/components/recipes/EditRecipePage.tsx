import { useNavigate } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { useMessages } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { Breadcrumbs, type Crumb } from '../app/Breadcrumbs'
import { ImageUploadField } from '../app/ImageUploadField'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { RecipeForm } from './RecipeForm'

type RecipeDetail = Doc<'recipes'> & { imageUrl: string | null }

export interface EditRecipePageProps {
  recipeId: string
}

/**
 * Editing a recipe, whole.
 *
 * A recipe is read through the Current Group, so a recipe that Group cannot
 * see renders "not found" rather than the form.
 */
export function EditRecipePage({ recipeId }: EditRecipePageProps) {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const recipe = useQuery(api.recipes.get, {
    id: recipeId as Id<'recipes'>,
    groupSlug,
  })
  const messages = useMessages()

  // Recipes → this recipe → Edit. Built here rather than in the form below,
  // because the two states that never reach the form — still loading, and not
  // visible from this Group — are the two where a way back matters most.
  const trail: Crumb[] = [
    { label: messages.modules.byId.recipes.label, link: linkTo('recipes') },
    ...(recipe ? [{ label: recipe.title, link: linkTo('recipe', { recipeId: recipe._id }) }] : []),
    { label: messages.common.actions.edit },
  ]

  if (recipe === undefined)
    return (
      <div>
        <Breadcrumbs trail={trail} />
        <p className="text-sm opacity-60">{messages.common.errors.loading}</p>
      </div>
    )
  if (recipe === null)
    return (
      <div>
        <Breadcrumbs trail={trail} />
        <p className="text-sm opacity-60">{messages.recipes.detail.notFound}</p>
      </div>
    )

  return (
    <EditRecipeForm key={recipe._id} recipe={recipe} trail={trail} />
  )
}

function EditRecipeForm({
  recipe,
  trail,
}: {
  recipe: RecipeDetail
  trail: readonly Crumb[]
}) {
  const update = useMutation(api.recipes.update)
  const generateUploadUrl = useMutation(api.recipes.generateUploadUrl)
  const aiConfigured = useQuery(api.recipes.aiConfigured)
  const estimateNutrition = useAction(api.recipeNutrition.estimateNutrition)
  const navigate = useNavigate()
  const { edit, form } = useMessages().recipes
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageId, setImageId] = useState<Id<'_storage'> | undefined>(
    recipe.imageId,
  )
  const [imageUrl, setImageUrl] = useState<string | null>(recipe.imageUrl)

  return (
    <div>
      <Breadcrumbs trail={trail} />
      <h1 className="mb-6 text-2xl font-semibold">{edit.title}</h1>
      {error && (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <ImageUploadField
        imageUrl={imageUrl}
        preset="recipePhoto"
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
            navigate(linkTo('recipe', { recipeId: recipe._id }))
          } catch (err) {
            setError(err instanceof Error ? err.message : form.saveFailed)
            setSubmitting(false)
          }
        }}
      />
    </div>
  )
}
