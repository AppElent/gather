import { Link } from '@tanstack/react-router'
import { useAction, useQuery } from 'convex/react'
import { Pencil, RefreshCw } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { fmt, useMessages } from '../../lib/i18n'
import { linkTo, newFoodLink } from '../../lib/links'
import { Breadcrumbs, type Crumb } from '../app/Breadcrumbs'
import { useConfirmAction } from '../app/ConfirmAction'
import { FoodThumbnail } from '../kitchen/FoodThumbnail'
import { NutritionPanel } from '../kitchen/NutritionPanel'

export interface FoodDetailPageProps {
  foodId: string
}

/** One Catalog food, whole. */
export function FoodDetailPage({ foodId }: FoodDetailPageProps) {
  const food = useQuery(api.foods.get, { id: foodId as Id<'foods'> })
  const refreshFromOff = useAction(api.foodsLookup.refreshFromOff)
  const { confirm, dialog } = useConfirmAction()
  const messages = useMessages()
  const { detail } = messages.foods

  // Foods → this food. The name is only known once the row arrives, so while
  // it is loading — and when it turns out not to exist — the trail is the
  // collection alone, which is still the way out of here.
  const trail: Crumb[] = [
    { label: messages.foods.list.title, link: linkTo('foods') },
    ...(food ? [{ label: food.name }] : []),
  ]

  if (food === undefined)
    return (
      <div className="mx-auto max-w-2xl">
        <Breadcrumbs trail={trail} />
        <p className="text-sm opacity-60">{messages.common.errors.loading}</p>
      </div>
    )
  if (food === null)
    return (
      <div className="mx-auto max-w-2xl">
        <Breadcrumbs trail={trail} />
        <p className="text-sm opacity-60">{detail.notFound}</p>
      </div>
    )

  return (
    <article className="mx-auto max-w-2xl">
      <Breadcrumbs trail={trail} />
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FoodThumbnail src={food.imageUrl} icon={food.icon} />
          <div>
            <h1 className="text-2xl font-semibold">{food.name}</h1>
            {food.brand && <p className="text-sm opacity-60">{food.brand}</p>}
          </div>
        </div>
        {/*
          Edit only when the save would be accepted: Catalog entries are owned
          by nobody and read-only (ADR 0004), and anything else only by whoever
          made it.
        */}
        {food.canEdit ? (
          <Link
            {...linkTo('editFood', { foodId })}
            aria-label={messages.common.actions.edit}
            className="inline-flex min-h-9 min-w-9 items-center justify-center rounded border no-underline lg:gap-2 lg:px-3 lg:py-1.5 lg:text-sm"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            <span className="hidden lg:inline">
              {messages.common.actions.edit}
            </span>
          </Link>
        ) : food.seedKey !== undefined ? (
          <span className="rounded border border-dashed px-3 py-1.5 text-sm opacity-60">
            {detail.builtIn}
          </span>
        ) : null}
      </div>

      {food.seedKey !== undefined && (
        <p className="mb-4 text-sm opacity-60">
          {detail.builtInNote}{' '}
          <Link {...newFoodLink()} className="underline">
            {detail.createYourOwn}
          </Link>
          .
        </p>
      )}

      {/*
        The badge says where the *figures* came from, which the row records
        for itself — not `source`, where the *row* came from: an imported row
        somebody has since typed over is not "Imported".

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
