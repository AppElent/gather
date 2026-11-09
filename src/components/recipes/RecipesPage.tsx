import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { Plus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { fmt, useMessages } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { SurfaceCard } from '../app/ShellPrimitives'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { RecipeCard } from './RecipeCard'
import { filterRecipes, recipeTags } from './recipeFilter'
import { useRecipeViewMode } from './useRecipeViewMode'
import { ViewModeToggle } from './ViewModeToggle'

/**
 * The recipe list, whole: exactly what the Current Group can see — its own
 * recipes and the ones shared into it, never the caller's other Groups', so two
 * Members of one Group see one collection. Searching by title and picking a
 * tag narrow what is already loaded; neither asks the server again.
 */
export function RecipesPage() {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const recipes = useQuery(api.recipes.list, { groupSlug })
  const [viewMode, setViewMode] = useRecipeViewMode()
  const messages = useMessages()
  const { list } = messages.recipes
  const [query, setQuery] = useState('')
  const [pickedTag, setPickedTag] = useState('')
  const tags = useMemo(() => recipeTags(recipes ?? []), [recipes])
  // A tag whose last recipe was deleted or retagged stops filtering.
  const tag = tags.includes(pickedTag) ? pickedTag : ''
  const shown = useMemo(
    () => filterRecipes(recipes ?? [], { query, tag }),
    [recipes, query, tag],
  )
  const clearFilters = () => {
    setQuery('')
    setPickedTag('')
  }

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
            {...linkTo('newRecipe')}
            aria-label={list.add}
            className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-fg)] no-underline lg:gap-2 lg:px-3 lg:text-sm lg:font-semibold"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden lg:inline">{list.add}</span>
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
              {...linkTo('newRecipe')}
              aria-label={list.emptyAction}
              className="mx-auto inline-flex min-h-9 min-w-9 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-border)] no-underline lg:gap-2 lg:px-3 lg:text-sm lg:font-semibold"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="hidden lg:inline">{list.emptyAction}</span>
            </Link>
          </div>
        </SurfaceCard>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <label className="relative block min-w-0 flex-1 basis-60">
              <span className="sr-only">{list.search}</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-muted)]"
                aria-hidden="true"
              />
              <input
                className="min-h-11 w-full rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] pl-10 pr-10 text-[16px] sm:text-sm"
                type="search"
                placeholder={list.search}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query ? (
                <button
                  type="button"
                  aria-label={list.clearSearch}
                  className="absolute right-1 top-1/2 grid min-h-9 min-w-9 -translate-y-1/2 place-items-center"
                  onClick={() => setQuery('')}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </label>
            {tags.length > 0 ? (
              <select
                aria-label={list.tagFilter}
                className="min-h-11 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-[16px] sm:text-sm"
                value={tag}
                onChange={(event) => setPickedTag(event.target.value)}
              >
                <option value="">{list.allTags}</option>
                {tags.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          {shown.length === 0 ? (
            <SurfaceCard>
              <div className="grid gap-3 text-center">
                <h3 className="m-0 text-base font-semibold">
                  {list.noResultsTitle}
                </h3>
                <p className="m-0 text-sm text-[var(--app-muted)]">
                  {tag
                    ? fmt(list.noResultsTaggedBody, {
                        query: query.trim(),
                        tag,
                      })
                    : fmt(list.noResultsBody, { query: query.trim() })}
                </p>
                <button
                  type="button"
                  className="mx-auto inline-flex min-h-9 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold"
                  onClick={clearFilters}
                >
                  {list.clearFilters}
                </button>
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
              {shown.map((r) => (
                <Link
                  key={r._id}
                  {...linkTo('recipe', { recipeId: r._id })}
                  className="block no-underline transition hover:opacity-90"
                >
                  <RecipeCard recipe={r} mode={viewMode} />
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
