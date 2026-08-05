import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { Plus } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { useMessages } from '../../lib/i18n'
import { SurfaceCard } from '../app/ShellPrimitives'
import { RecipeCard } from './RecipeCard'
import type { RecipeNav } from './recipeNav'
import { useRecipeViewMode } from './useRecipeViewMode'
import { ViewModeToggle } from './ViewModeToggle'

/**
 * The recipe list, whole: one Group's collection.
 *
 * The slug is required, and the page shows exactly what that Group can see —
 * its own recipes and the ones shared into it. A page that unioned in the
 * caller's other Groups would show two Members of one Group different
 * collections at the same URL, which is what ADR-0002 exists to stop.
 */
export function RecipesPage({
  nav,
  groupSlug,
}: {
  nav: RecipeNav
  groupSlug: string
}) {
  const recipes = useQuery(api.recipes.list, { groupSlug })
  const [viewMode, setViewMode] = useRecipeViewMode()
  const messages = useMessages()
  const { list } = messages.recipes

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-2xl font-semibold">
            {messages.modules.byId.recipes.label}
          </h2>
          <p className="mt-1 text-sm text-[var(--app-muted)]">
            {list.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
          <Link
            {...nav.create}
            className="inline-flex min-h-9 items-center gap-2 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm font-semibold text-[var(--app-fg)] no-underline"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {list.add}
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
            <h3 className="m-0 text-base font-semibold">{list.emptyTitle}</h3>
            <p className="m-0 text-sm text-[var(--app-muted)]">
              {list.emptyBody}
            </p>
            <Link
              {...nav.create}
              className="mx-auto inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold no-underline"
            >
              {list.emptyAction}
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
