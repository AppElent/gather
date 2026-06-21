import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_app/recipes/$recipeId')({
  component: RecipeDetail,
})

function RecipeDetail() {
  const { recipeId } = Route.useParams()
  const recipe = useQuery(api.recipes.get, { id: recipeId as Id<'recipes'> })
  const remove = useMutation(api.recipes.remove)
  const navigate = useNavigate()

  if (recipe === undefined) return <p className="text-sm opacity-60">Loading…</p>
  if (recipe === null) return <p className="text-sm opacity-60">Recipe not found.</p>

  return (
    <article className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{recipe.title}</h1>
        <div className="flex gap-2">
          <Link to="/recipes/$recipeId/edit" params={{ recipeId }} className="rounded border px-3 py-1.5 text-sm no-underline">Edit</Link>
          <button
            type="button"
            className="rounded border px-3 py-1.5 text-sm"
            onClick={async () => {
              await remove({ id: recipe._id })
              navigate({ to: '/recipes' })
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {recipe.imageUrl && (
        <img src={recipe.imageUrl} alt={recipe.title} className="mb-4 w-full rounded-xl object-cover" />
      )}
      {recipe.description && <p className="mb-4 opacity-80">{recipe.description}</p>}

      <h2 className="mb-2 font-medium">Ingredients</h2>
      <ul className="mb-4 list-disc pl-5 text-sm">
        {recipe.ingredients.map((i, idx) => (
          <li key={idx}>{i}</li>
        ))}
      </ul>

      <h2 className="mb-2 font-medium">Steps</h2>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        {recipe.steps.map((s, idx) => (
          <li key={idx}>{s}</li>
        ))}
      </ol>
    </article>
  )
}
