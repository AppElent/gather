import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { Search, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { fmt, plural, useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { EmptyState } from '../app/EmptyState'
import { InsetList, InsetRow, RowThumb } from '../app/InsetList'
import { ModuleTile } from '../app/ModuleTile'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { useIsDesktop } from '../app/useMediaQuery'
import { WashHeader } from '../app/WashHeader'
import { RecipeCard } from './RecipeCard'
import { RECIPES_ICON, RecipeStars } from './RecipeThumbnail'
import { filterRecipes, recipeTags, sameTag } from './recipeFilter'
import { useRecipeViewMode } from './useRecipeViewMode'
import { ViewModeToggle } from './ViewModeToggle'

/**
 * The recipe list, whole: exactly what the Current Group can see — its own
 * recipes and the ones shared into it, never the caller's other Groups', so two
 * Members of one Group see one collection. Searching by title and picking a
 * tag narrow what is already loaded; neither asks the server again.
 */
export function RecipesPage() {
  const group = useRequiredCurrentGroup()
  const recipes = useQuery(api.recipes.list, { groupSlug: group.slug })
  const [viewMode, setViewMode] = useRecipeViewMode()
  const { locale, messages } = useI18n()
  const { list } = messages.recipes
  const moduleName = messages.modules.byId.recipes.label
  const [query, setQuery] = useState('')
  const [pickedTag, setPickedTag] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const desktop = useIsDesktop()
  const tags = useMemo(() => recipeTags(recipes ?? []), [recipes])
  // A tag whose last recipe was deleted or retagged stops filtering, and is
  // forgotten so it does not quietly filter again if it comes back.
  const tag = (pickedTag && tags.find((t) => sameTag(t, pickedTag))) || ''
  if (pickedTag && !tag) setPickedTag('')
  const shown = useMemo(
    () => filterRecipes(recipes ?? [], { query, tag }),
    [recipes, query, tag],
  )
  const clearFilters = () => {
    setQuery('')
    setPickedTag('')
  }
  const hasRecipes = Boolean(recipes?.length)

  // Two inset lists side by side on a desktop, as in the approved board; one
  // on anything narrower.
  const columns =
    desktop && shown.length > 1
      ? [
          shown.slice(0, Math.ceil(shown.length / 2)),
          shown.slice(Math.ceil(shown.length / 2)),
        ]
      : [shown]

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-4">
      <WashHeader
        group="kitchen"
        icon={RECIPES_ICON}
        title={moduleName}
        summary={
          recipes
            ? {
                count: plural(locale, recipes.length, list.count),
                scope: group.name,
              }
            : undefined
        }
        onSearch={hasRecipes ? () => searchRef.current?.focus() : undefined}
        primary={{ label: list.add, link: linkTo('newRecipe') }}
      />

      {recipes === undefined ? (
        <InsetList label={messages.common.errors.loading}>
          {[0, 1, 2].map((index) => (
            <li
              key={index}
              className="flex min-h-[72px] items-center gap-3 px-4 [&+li]:border-t-[0.5px] [&+li]:border-[var(--hair)]"
            >
              <span className="size-[46px] animate-pulse rounded-[var(--radius-thumb)] bg-[var(--surface-2)] motion-reduce:animate-none" />
              <span className="h-4 w-40 animate-pulse rounded-[var(--radius-pill)] bg-[var(--surface-2)] motion-reduce:animate-none" />
            </li>
          ))}
        </InsetList>
      ) : !hasRecipes ? (
        <EmptyState
          kind="nothing-yet"
          tile={{ group: 'kitchen', icon: RECIPES_ICON }}
          title={list.emptyTitle}
          body={list.emptyBody}
          action={{ label: list.emptyAction, link: linkTo('newRecipe') }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex min-h-10 min-w-0 flex-1 basis-60 items-center rounded-[var(--radius-pill)] border border-[var(--control-edge)] bg-[var(--surface)] text-[var(--muted)] focus-within:border-[var(--ink)] lg:max-w-[300px]">
              <span className="sr-only">{list.search}</span>
              <Search
                className="pointer-events-none absolute left-3.5 size-4"
                aria-hidden="true"
              />
              <input
                ref={searchRef}
                className="min-h-10 w-full rounded-[var(--radius-pill)] border-0 bg-transparent pr-10 pl-10 text-[16px] text-[var(--ink)] outline-none sm:text-subhead"
                type="search"
                placeholder={list.search}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query ? (
                <button
                  type="button"
                  aria-label={list.clearSearch}
                  className="absolute right-0.5 grid size-9 place-items-center rounded-[var(--radius-pill)] text-[var(--muted)] hover:text-[var(--ink)]"
                  onClick={() => setQuery('')}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </label>
            <div className="ml-auto">
              <ViewModeToggle mode={viewMode} onChange={setViewMode} />
            </div>
            {/* Their own line: one that scrolls sideways on a phone, and as many
                as they need from lg. */}
            {tags.length > 0 ? (
              <fieldset className="m-0 flex min-w-0 basis-full gap-2 overflow-x-auto border-0 p-0.5 lg:flex-wrap">
                <legend className="sr-only">{list.tagFilter}</legend>
                {['', ...tags].map((name) => {
                  const on = name === tag
                  return (
                    <button
                      key={name || '*'}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPickedTag(name)}
                      className={`inline-flex min-h-9 shrink-0 items-center rounded-[var(--radius-pill)] px-3.5 text-subhead font-semibold ${
                        on
                          ? 'bg-[var(--ink)] text-[var(--on-ink)]'
                          : 'bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-2)]'
                      }`}
                    >
                      {name || list.allTags}
                    </button>
                  )
                })}
              </fieldset>
            ) : null}
          </div>

          {shown.length === 0 ? (
            <EmptyState
              kind="nothing-found"
              title={list.noResultsTitle}
              body={
                tag
                  ? fmt(list.noResultsTaggedBody, { query: query.trim(), tag })
                  : fmt(list.noResultsBody, { query: query.trim() })
              }
              action={{ label: list.clearFilters, onClick: clearFilters }}
            />
          ) : viewMode === 'compact' ? (
            <div className="grid items-start gap-4 lg:grid-cols-2">
              {columns.map((column) => (
                <InsetList key={column[0]._id}>
                  {column.map((recipe) => (
                    <InsetRow
                      key={recipe._id}
                      title={recipe.title}
                      link={linkTo('recipe', { recipeId: recipe._id })}
                      leading={
                        <RowThumb
                          src={recipe.imageUrl}
                          fallback={
                            <ModuleTile group="kitchen" icon={RECIPES_ICON} />
                          }
                        />
                      }
                      footnote={
                        recipe.rating != null || recipe.tags.length ? (
                          <>
                            <RecipeStars
                              rating={recipe.rating}
                              label={
                                recipe.rating != null
                                  ? plural(
                                      locale,
                                      recipe.rating,
                                      messages.recipes.rating.stars,
                                    )
                                  : undefined
                              }
                            />
                            {recipe.rating != null && recipe.tags.length
                              ? ' · '
                              : null}
                            {recipe.tags.join(', ')}
                          </>
                        ) : undefined
                      }
                    />
                  ))}
                </InsetList>
              ))}
            </div>
          ) : (
            <div
              className={
                viewMode === 'banner'
                  ? 'grid gap-3 sm:grid-cols-2'
                  : 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3'
              }
            >
              {shown.map((r) => (
                <Link
                  key={r._id}
                  {...linkTo('recipe', { recipeId: r._id })}
                  className="block text-[var(--ink)] no-underline transition hover:opacity-90"
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
