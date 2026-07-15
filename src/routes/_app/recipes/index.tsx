import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { RecipeCard } from '../../../components/recipes/RecipeCard'
import { useRecipeViewMode } from '../../../components/recipes/useRecipeViewMode'
import { ViewModeToggle } from '../../../components/recipes/ViewModeToggle'

export const Route = createFileRoute('/_app/recipes/')({
  component: RecipeList,
})

function RecipeList() {
  const recipes = useQuery(api.recipes.list)
  const [viewMode, setViewMode] = useRecipeViewMode()

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recipes</h1>
        <div className="flex items-center gap-3">
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
          <Link
            to="/recipes/new"
            className="rounded-md border px-3 py-1.5 text-sm no-underline"
          >
            Add recipe
          </Link>
        </div>
      </div>

      {recipes === undefined ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border bg-black/5"
            />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <div className="rounded-xl border p-10 text-center">
          <p className="mb-3 text-sm opacity-70">No recipes yet.</p>
          <Link
            to="/recipes/new"
            className="rounded-md border px-3 py-1.5 text-sm no-underline"
          >
            Add your first recipe
          </Link>
        </div>
      ) : (
        <div
          className={
            viewMode === 'compact'
              ? 'flex flex-col gap-2'
              : 'grid grid-cols-2 gap-4 sm:grid-cols-3'
          }
        >
          {recipes.map((r) => (
            <Link
              key={r._id}
              to="/recipes/$recipeId"
              params={{ recipeId: r._id }}
              className="block no-underline transition hover:opacity-90"
            >
              <RecipeCard recipe={r} mode={viewMode} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
