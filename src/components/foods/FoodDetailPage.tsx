import { Link } from '@tanstack/react-router'
import { useAction, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
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

  if (food === undefined) return <p className="text-sm opacity-60">Loading…</p>
  if (food === null)
    return <p className="text-sm opacity-60">Food not found.</p>

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
            className="rounded border px-3 py-1.5 text-sm no-underline"
          >
            Edit
          </Link>
        ) : (
          <span className="rounded border border-dashed px-3 py-1.5 text-sm opacity-60">
            Built-in
          </span>
        )}
      </div>

      {food.seedKey !== undefined && (
        <p className="mb-4 text-sm opacity-60">
          Part of gather's built-in food catalog, so it can't be edited. Need a
          different version?{' '}
          {/* Through the Group in the address; the flat `/foods/new` this
              arrived as is gone (ADR-0002). */}
          <Link {...nav.create()} className="underline">
            Create your own food
          </Link>
          .
        </p>
      )}

      {/*
        Reusing the "imported"/"manual" NutritionSource vocabulary for a
        food's `source` field ('openfoodfacts'/'manual') rather than adding
        a fourth badge type — "Imported" reads fine for OFF-sourced data too,
        and it avoids new plumbing just for foods. If this reads awkwardly
        once real foods exist, revisit in Phase 3.
      */}
      <NutritionPanel
        nutrition={food.nutritionPer100}
        unitLabel={`per 100 ${food.baseUnit}`}
        source={
          food.source === 'seed'
            ? // Neither "Imported" nor "Manual" is true of a Catalog entry,
              // and the "Built-in" chip above already says where it came
              // from — so no badge rather than a wrong one.
              undefined
            : food.source === 'openfoodfacts'
              ? 'imported'
              : 'manual'
        }
      />
      {food.servingLabel && (
        <p className="mb-4 text-sm opacity-60">Serving: {food.servingLabel}</p>
      )}
      {food.source === 'openfoodfacts' && (
        <p className="mb-4 text-xs opacity-60">
          Nutrition data from{' '}
          <a
            href="https://world.openfoodfacts.org"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Open Food Facts
          </a>{' '}
          (ODbL).
        </p>
      )}
      {food.barcode && (
        <button
          type="button"
          className="rounded border px-3 py-1.5 text-sm"
          onClick={() =>
            confirm({
              title: 'Refresh from Open Food Facts?',
              body: 'This food is overwritten with the latest data there. Any local edits are replaced.',
              confirmLabel: 'Refresh',
              errorFallback: 'Could not refresh from Open Food Facts.',
              run: () => refreshFromOff({ id: food._id }),
            })
          }
        >
          Refresh from Open Food Facts
        </button>
      )}

      {dialog}
    </article>
  )
}
