import { AI_LIMIT_KIND } from '@gather/core/ai-limit'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useErrorMessage } from '../../lib/errorMessage'
import { fmt, plural, useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { Breadcrumbs, type Crumb } from '../app/Breadcrumbs'
import { buttonClass } from '../app/buttons'
import { useConfirmAction } from '../app/ConfirmAction'
import { InsetList, InsetRow, SectionLabel } from '../app/InsetList'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { WashHeader } from '../app/WashHeader'
import { NutritionPanel } from './NutritionPanel'
import { RecipeSharingPanel } from './RecipeSharingPanel'
import { RECIPES_ICON } from './RecipeThumbnail'

export interface RecipeDetailPageProps {
  recipeId: string
}

/**
 * One recipe, whole, as read from the Current Group.
 *
 * A recipe that is not visible from this Group comes back as null from
 * `recipes.get` and renders as "not found" — the same answer for a deleted
 * recipe, for one that was never theirs, and for one they can see but only from
 * somewhere else. The page never says whether it exists.
 */
export function RecipeDetailPage({ recipeId }: RecipeDetailPageProps) {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const recipe = useQuery(api.recipes.get, {
    id: recipeId as Id<'recipes'>,
    groupSlug,
  })
  const remove = useMutation(api.recipes.remove)
  const navigate = useNavigate()
  const { confirm, dialog } = useConfirmAction()
  const [error, setError] = useState<string | null>(null)
  const aiConfigured = useQuery(api.recipes.aiConfigured)
  const estimateNutrition = useAction(api.recipeNutrition.estimateNutrition)
  const setNutrition = useMutation(api.recipes.setNutrition)
  const [estimating, setEstimating] = useState(false)
  const { locale, messages } = useI18n()
  const errorText = useErrorMessage()
  const { detail, form } = messages.recipes

  // Recipes → this recipe. A recipe read from a Group it was only shared into
  // still belongs to that Group's list as far as navigation goes, which is
  // where back has to land.
  const trail: Crumb[] = [
    { label: messages.modules.byId.recipes.label, link: linkTo('recipes') },
    ...(recipe ? [{ label: recipe.title }] : []),
  ]

  if (recipe === undefined)
    return (
      <div className="mx-auto max-w-3xl">
        <Breadcrumbs trail={trail} />
        <p className="text-sm text-[var(--muted)]">
          {messages.common.errors.loading}
        </p>
      </div>
    )
  if (recipe === null)
    return (
      <div className="mx-auto max-w-3xl">
        <Breadcrumbs trail={trail} />
        <p className="text-sm text-[var(--muted)]">{detail.notFound}</p>
      </div>
    )

  const confirmDelete = () =>
    confirm({
      title: detail.deleteTitle,
      body: fmt(detail.deleteBody, { title: recipe.title }),
      confirmLabel: messages.common.actions.delete,
      errorFallback: detail.deleteFailed,
      run: async () => {
        await remove({ id: recipe._id })
        await navigate(linkTo('recipes'))
      },
    })

  return (
    <article className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-5">
      <Breadcrumbs trail={trail} className="-mb-2" />
      <WashHeader
        group="kitchen"
        icon={RECIPES_ICON}
        title={recipe.title}
        summary={{
          count:
            recipe.rating != null
              ? plural(locale, recipe.rating, messages.recipes.rating.stars)
              : plural(locale, recipe.ingredients.length, detail.ingredientCount),
          // Who to ask about it. Resolved by `recipes.get`, and absent once that
          // person's row has gone.
          scope: recipe.addedByName
            ? fmt(detail.addedBy, { name: recipe.addedByName })
            : undefined,
        }}
        // A recipe reaches a Group it was only shared into as something to
        // read: writing follows the home Group. Offering Edit anyway would be
        // an action that can only fail on click.
        primary={
          recipe.canEdit
            ? {
                label: messages.common.actions.edit,
                link: linkTo('editRecipe', { recipeId }),
                icon: <Pencil className="size-[18px]" aria-hidden="true" />,
              }
            : undefined
        }
      />

      {error && (
        <p
          role="alert"
          className="m-0 rounded-[var(--radius-control)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--danger)]"
        >
          {error}
        </p>
      )}

      {/* No photo, no picture: the header's tile already says what this is. */}
      {recipe.imageUrl ? (
        <img
          src={recipe.imageUrl}
          alt=""
          className="h-64 w-full rounded-[var(--radius-card)] object-cover lg:h-80"
        />
      ) : null}
      {recipe.description || recipe.sourceUrl ? (
        <div className="grid gap-2">
          {recipe.description && (
            <p className="m-0 text-body">{recipe.description}</p>
          )}
          {recipe.sourceUrl && (
            <p className="m-0 text-footnote text-[var(--muted)]">
              {detail.importedFrom}{' '}
              <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">
                {new URL(recipe.sourceUrl).hostname.replace(/^www\./, '')}
              </a>
            </p>
          )}
        </div>
      ) : null}

      {/*
        Offered to anyone who can change this recipe — which is every Member of
        the Group it lives in, and not only whoever added it. A Group it was
        shared into can read it and no more, so `canEdit` comes back false there
        and the prompt to re-estimate stays out of the way.
      */}
      {recipe.nutritionStale && recipe.canEdit && (
        <div className="grid gap-3 rounded-[var(--radius-card)] bg-[var(--surface)] p-4 text-subhead">
          <p className="m-0">{detail.staleNutrition}</p>
          <div className="flex flex-wrap gap-2">
            {aiConfigured && (
              <button
                type="button"
                disabled={estimating}
                className={buttonClass.secondary}
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
                      errorText(err, form.estimateFailed, {
                        [AI_LIMIT_KIND]: form.aiLimitReached,
                      }),
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
              {...linkTo('editRecipe', { recipeId: recipeId })}
              aria-label={detail.editManually}
              className={`${buttonClass.secondary} max-lg:w-[var(--size-control-min)] max-lg:px-0`}
            >
              <Pencil className="size-4" aria-hidden="true" />
              <span className="hidden lg:inline">{detail.editManually}</span>
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

      {recipe.ingredients.length > 0 ? (
        <section>
          <SectionLabel>{form.ingredients}</SectionLabel>
          <InsetList>
            {recipe.ingredients.map((ingredient, index) => (
              <InsetRow key={index} title={ingredient} />
            ))}
          </InsetList>
        </section>
      ) : null}

      {recipe.steps.length > 0 ? (
        <section>
          <SectionLabel>{form.steps}</SectionLabel>
          <InsetList>
            {recipe.steps.map((step, index) => (
              <InsetRow
                key={index}
                leading={
                  <span
                    aria-hidden="true"
                    className="grid size-7 place-items-center rounded-[var(--radius-pill)] bg-[var(--surface-2)] font-rounded text-footnote font-bold tabular-nums"
                  >
                    {index + 1}
                  </span>
                }
                title={
                  <>
                    <span className="sr-only">{index + 1}. </span>
                    {step}
                  </>
                }
              />
            ))}
          </InsetList>
        </section>
      ) : null}

      {recipe.canEdit ? (
        <div>
          <button
            type="button"
            className={buttonClass.danger}
            onClick={confirmDelete}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {messages.common.actions.delete}
          </button>
        </div>
      ) : null}

      {dialog}
    </article>
  )
}
