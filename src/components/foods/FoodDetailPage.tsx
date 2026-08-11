import { Link } from '@tanstack/react-router'
import { useAction, useQuery } from 'convex/react'
import { Pencil, RefreshCw } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { fmt, useMessages } from '../../lib/i18n'
import { useConfirmAction } from '../app/ConfirmAction'
import { NutritionPanel } from '../recipes/NutritionPanel'
import type { FoodNav } from './foodNav'

export interface FoodDetailPageProps {
  foodId: string
  nav: FoodNav
}

/** One Catalog food, whole. Shared by both detail routes. */
export function FoodDetailPage({ foodId, nav }: FoodDetailPageProps) {
  const food = useQuery(api.foods.get, { id: foodId as Id<'foods'> })
  const refreshFromOff = useAction(api.foodsLookup.refreshFromOff)
  const { confirm, dialog } = useConfirmAction()
  const messages = useMessages()
  const { detail } = messages.foods

  if (food === undefined)
    return (
      <p className="text-sm opacity-60">{messages.common.errors.loading}</p>
    )
  if (food === null)
    return <p className="text-sm opacity-60">{detail.notFound}</p>

  return (
    <article className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{food.name}</h1>
          {food.brand && <p className="text-sm opacity-60">{food.brand}</p>}
        </div>
        {/*
          Catalog entries are owned by nobody and read-only (ADR 0004) — the
          next Catalog seed overwrites them unconditionally, so offering an
          edit that silently reverts would be worse than offering none.
        */}
        {food.seedKey === undefined ? (
          <Link
            {...nav.edit(foodId)}
            aria-label={messages.common.actions.edit}
            className="inline-flex min-h-9 min-w-9 items-center justify-center rounded border no-underline lg:gap-2 lg:px-3 lg:py-1.5 lg:text-sm"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            <span className="hidden lg:inline">
              {messages.common.actions.edit}
            </span>
          </Link>
        ) : (
          <span className="rounded border border-dashed px-3 py-1.5 text-sm opacity-60">
            {detail.builtIn}
          </span>
        )}
      </div>

      {food.seedKey !== undefined && (
        <p className="mb-4 text-sm opacity-60">
          {detail.builtInNote}{' '}
          {/* Through the Group in the address; the flat `/foods/new` this
              arrived as is gone (ADR-0002). */}
          <Link {...nav.create()} className="underline">
            {detail.createYourOwn}
          </Link>
          .
        </p>
      )}

      {/*
        The badge says where the *figures* came from, which the row now
        records for itself. It used to be derived from `source` — where the
        *row* came from — which answered the wrong question: an imported row
        somebody had since typed over still read "Imported".

        A food that recorded nothing (anything older than the field, and every
        Catalog entry, whose figures are authored) gets no badge rather than a
        guessed one. Nothing is backfilled.
      */}
      <NutritionPanel
        nutrition={food.nutritionPer100}
        unitLabel={fmt(detail.per100, { unit: food.baseUnit })}
        source={food.nutritionSource}
      />
      {food.servings && food.servings.length > 0 && (
        <p className="mb-4 text-sm opacity-60">
          {fmt(detail.servings, {
            servings: food.servings
              .map(
                (serving) =>
                  `${serving.label} — ${serving.amount} ${food.baseUnit}`,
              )
              .join(', '),
          })}
        </p>
      )}
      {food.source === 'openfoodfacts' && (
        <p className="mb-4 text-xs opacity-60">
          {detail.dataFrom}{' '}
          <a
            href="https://world.openfoodfacts.org"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {detail.openFoodFacts}
          </a>{' '}
          {detail.odbl}
        </p>
      )}
      {food.barcode && (
        <button
          type="button"
          aria-label={detail.refresh}
          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded border lg:gap-2 lg:px-3 lg:py-1.5 lg:text-sm"
          onClick={() =>
            confirm({
              title: detail.refreshTitle,
              body: detail.refreshBody,
              confirmLabel: detail.refreshConfirm,
              errorFallback: detail.refreshFailed,
              run: () => refreshFromOff({ id: food._id }),
            })
          }
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          <span className="hidden lg:inline">{detail.refresh}</span>
        </button>
      )}

      {dialog}
    </article>
  )
}
