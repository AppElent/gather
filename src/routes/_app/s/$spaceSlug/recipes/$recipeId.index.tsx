import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../../../../convex/_generated/api'
import type { Id } from '../../../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_app/s/$spaceSlug/recipes/$recipeId/')({
  component: RecipeDetail,
})

function RecipeDetail() {
  const { recipeId, spaceSlug } = Route.useParams()
  const recipe = useQuery(api.recipes.get, {
    spaceSlug,
    id: recipeId as Id<'recipes'>,
  })
  const remove = useMutation(api.recipes.remove)
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  if (recipe === undefined)
    return <p className="text-sm opacity-60">Loading…</p>
  if (recipe === null)
    return <p className="text-sm opacity-60">Recipe not found.</p>
  return (
    <article className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{recipe.title}</h1>
          {recipe.rating != null && (
            <p className="text-sm opacity-60">{'★'.repeat(recipe.rating)}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            to="/s/$spaceSlug/recipes/$recipeId/edit"
            params={{ spaceSlug, recipeId }}
            className="rounded border px-3 py-1.5 text-sm no-underline"
          >
            Edit
          </Link>
          <button
            type="button"
            className="rounded border px-3 py-1.5 text-sm"
            onClick={async () => {
              setError(null)
              try {
                await remove({ spaceSlug, id: recipe._id })
                navigate({ to: '/s/$spaceSlug/recipes', params: { spaceSlug } })
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : 'Could not delete recipe',
                )
              }
            }}
          >
            Delete
          </button>
        </div>
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
      {recipe.sourceUrl && (
        <p className="mb-4 text-xs opacity-60">
          Imported from{' '}
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
      <h2 className="mb-2 font-medium">Ingredients</h2>
      <ul className="mb-4 list-disc pl-5 text-sm">
        {recipe.ingredients.map((ingredient, index) => (
          <li key={index}>{ingredient}</li>
        ))}
      </ul>
      <h2 className="mb-2 font-medium">Steps</h2>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        {recipe.steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
    </article>
  )
}
