import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { Plus } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { SurfaceCard } from '../app/ShellPrimitives'
import { RecipeCard } from './RecipeCard'
import type { RecipeNav } from './recipeNav'
import { useRecipeViewMode } from './useRecipeViewMode'
import { ViewModeToggle } from './ViewModeToggle'

/**
 * The recipe list, whole.
 *
 * Both `/recipes` and `/g/<slug>/recipes` render this one component, so the
 * Group-scoped tree cannot drift away from the flat one. Where it links to is
 * the only thing the two routes disagree about, and that arrives as `nav`.
 *
 * Which recipes it shows is not decided here and does not change with the
 * Group: a recipe is still owned by the person who added it and shared into
 * Groups from there. #19 moves ownership to the Group; until then the Group in
 * the URL governs navigation only.
 */
export function RecipesPage({ nav }: { nav: RecipeNav }) {
  const recipes = useQuery(api.recipes.list)
  const [viewMode, setViewMode] = useRecipeViewMode()

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-2xl font-semibold">Recipes</h2>
          <p className="mt-1 text-sm text-[var(--app-muted)]">
            Keep and rate the dishes this group cooks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
          <Link
            {...nav.create}
            className="inline-flex min-h-9 items-center gap-2 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm font-semibold text-[var(--app-fg)] no-underline"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add recipe
          </Link>
        </div>
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
              {...nav.create}
              className="mx-auto inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold no-underline"
            >
              Add your first recipe
            </Link>
          </div>
        </SurfaceCard>
      ) : (
        <div
          className={
            viewMode === 'compact'
              ? 'flex flex-col gap-2'
              : 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3'
          }
        >
          {recipes.map((r) => (
            <Link
              key={r._id}
              {...nav.detail(r._id)}
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
