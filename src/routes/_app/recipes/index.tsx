import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { Plus } from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import { Pill, SurfaceCard } from '../../../components/app/ShellPrimitives'

export const Route = createFileRoute('/_app/recipes/')({
  component: RecipeList,
})

function RecipeList() {
  const recipes = useQuery(api.recipes.list)

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-2xl font-semibold">Recipes</h2>
          <p className="mt-1 text-sm text-[var(--app-muted)]">
            Keep and rate the dishes this group cooks.
          </p>
        </div>
        <Link
          to="/recipes/new"
          className="inline-flex min-h-9 items-center gap-2 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm font-semibold text-[var(--app-fg)] no-underline"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add recipe
        </Link>
      </div>

      {recipes === undefined ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface-muted)]"
            />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <SurfaceCard>
          <div className="grid gap-3 text-center">
            <h3 className="m-0 text-base font-semibold">No recipes yet</h3>
            <p className="m-0 text-sm text-[var(--app-muted)]">
              Add the first recipe to make this module useful for the group.
            </p>
            <Link
              to="/recipes/new"
              className="mx-auto inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold no-underline"
            >
              Add your first recipe
            </Link>
          </div>
        </SurfaceCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {recipes.map((recipe) => (
            <Link
              key={recipe._id}
              to="/recipes/$recipeId"
              params={{ recipeId: recipe._id }}
              className="grid min-h-32 gap-3 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-[var(--app-fg)] no-underline hover:border-[var(--app-fg)]"
            >
              <div>
                <h3 className="m-0 text-sm font-semibold">{recipe.title}</h3>
                {recipe.description ? (
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--app-muted)]">
                    {recipe.description}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 self-end">
                {recipe.rating != null ? (
                  <Pill>{'★'.repeat(recipe.rating)}</Pill>
                ) : null}
                {recipe.tags.slice(0, 3).map((tag) => (
                  <Pill key={tag}>{tag}</Pill>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
