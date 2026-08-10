import { Link, useNavigate } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { fmt, useMessages } from '../../lib/i18n'
import { NutritionPanel } from './NutritionPanel'
import { RecipeSharingPanel } from './RecipeSharingPanel'
import type { RecipeNav } from './recipeNav'

export interface RecipeDetailPageProps {
  recipeId: string
  groupSlug: string
  nav: RecipeNav
}

/**
 * One recipe, whole, as read from the Group in the URL.
 *
 * A recipe that is not visible from this Group comes back as null from
 * `recipes.get` and renders as "not found" — the same answer for a deleted
 * recipe, for one that was never theirs, and for one they can see but only from
 * somewhere else. The page never says whether it exists.
 */
export function RecipeDetailPage({
  recipeId,
  groupSlug,
  nav,
}: RecipeDetailPageProps) {
  const recipe = useQuery(api.recipes.get, {
    id: recipeId as Id<'recipes'>,
    groupSlug,
  })
  const remove = useMutation(api.recipes.remove)
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const aiConfigured = useQuery(api.recipes.aiConfigured)
  const estimateNutrition = useAction(api.recipeNutrition.estimateNutrition)
  const setNutrition = useMutation(api.recipes.setNutrition)
  const [estimating, setEstimating] = useState(false)
  const messages = useMessages()
  const { detail, form } = messages.recipes

  if (recipe === undefined)
    return (
      <p className="text-sm opacity-60">{messages.common.errors.loading}</p>
    )
  if (recipe === null)
    return <p className="text-sm opacity-60">{detail.notFound}</p>

  return (
    <article className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{recipe.title}</h1>
          {recipe.rating != null && (
            <p className="text-sm opacity-60">{'★'.repeat(recipe.rating)}</p>
          )}
        </div>
        {/* A recipe reaches a Group it was only shared into as something to
            read: writing follows the home Group. Showing the buttons anyway
            would offer an action that can only fail on click. */}
        {recipe.canEdit && (
          <div className="flex gap-2">
            <Link
              {...nav.edit(recipeId)}
              aria-label={messages.common.actions.edit}
              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded border no-underline"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Link>
            <button
              type="button"
              aria-label={messages.common.actions.delete}
              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded border"
              onClick={async () => {
                setError(null)
                try {
                  await remove({ id: recipe._id })
                  navigate(nav.list)
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : detail.deleteFailed,
                  )
                }
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {recipe.imageUrl && (
        <img
          src={recipe.imageUrl}
          alt={recipe.title}
          className="mb-4 w-full rounded-xl object-cover"
        />
      )}
      {recipe.description && (
        <p className="mb-4 opacity-80">{recipe.description}</p>
      )}
      {/*
        Attribution: who to ask about this recipe, and nothing more. The name is
        resolved by `recipes.get`, so reading a recipe never turns into reading
        the `users` table; if that person's row has gone the line is simply not
        there, which is a better answer than an empty "Added by".
      */}
      {recipe.addedByName && (
        <p className="mb-4 text-xs opacity-60">
          {fmt(detail.addedBy, { name: recipe.addedByName })}
        </p>
      )}
      {recipe.sourceUrl && (
        <p className="mb-4 text-xs opacity-60">
          {detail.importedFrom}{' '}
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {new URL(recipe.sourceUrl).hostname.replace(/^www\./, '')}
          </a>
        </p>
      )}

      {/*
        Offered to anyone who can change this recipe — which is every Member of
        the Group it lives in, and not only whoever added it. A Group it was
        shared into can read it and no more, so `canEdit` comes back false there
        and the prompt to re-estimate stays out of the way.
      */}
      {recipe.nutritionStale && recipe.canEdit && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="mb-2">{detail.staleNutrition}</p>
          <div className="flex gap-2">
            {aiConfigured && (
              <button
                type="button"
                disabled={estimating}
                className="rounded border border-amber-400 px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60"
                onClick={async () => {
                  setEstimating(true)
                  setError(null)
                  try {
                    const nutrition = await estimateNutrition({
                      ingredients: recipe.ingredients,
                      servings: recipe.servings,
                    })
                    await setNutrition({
                      id: recipe._id,
                      nutrition,
                      source: 'ai',
                    })
                  } catch (err) {
                    setError(
                      err instanceof ConvexError
                        ? typeof err.data === 'string'
                          ? err.data
                          : form.estimateFailed
                        : err instanceof Error
                          ? err.message
                          : form.estimateFailed,
                    )
                  } finally {
                    setEstimating(false)
                  }
                }}
              >
                {estimating ? form.estimating : detail.reEstimate}
              </button>
            )}
            <Link
              {...nav.edit(recipeId)}
              aria-label={detail.editManually}
              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded border border-amber-400 no-underline"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}
      {/* Where this recipe lives and who else can see it. Offered on the same
          terms as Edit and Delete: moving or sharing follows the home Group,
          not the shared list. */}
      {recipe.canEdit && (
        <RecipeSharingPanel
          recipeId={recipe._id}
          homeGroupName={recipe.homeGroupName}
          homeGroupSlug={recipe.homeGroupSlug}
          sharedGroups={recipe.sharedGroups}
        />
      )}

      {recipe.nutrition && (
        <NutritionPanel
          nutrition={recipe.nutrition}
          unitLabel={
            recipe.servings
              ? fmt(detail.perServingOf, { count: recipe.servings })
              : detail.perServing
          }
          source={recipe.nutritionSource}
        />
      )}

      <h2 className="mb-2 font-medium">{form.ingredients}</h2>
      <ul className="mb-4 list-disc pl-5 text-sm">
        {recipe.ingredients.map((i, idx) => (
          <li key={idx}>{i}</li>
        ))}
      </ul>

      <h2 className="mb-2 font-medium">{form.steps}</h2>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        {recipe.steps.map((s, idx) => (
          <li key={idx}>{s}</li>
        ))}
      </ol>
    </article>
  )
}
