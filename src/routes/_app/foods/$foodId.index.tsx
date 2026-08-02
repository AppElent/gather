import { createFileRoute, Link } from '@tanstack/react-router'
import { useAction, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { NutritionPanel } from '../../../components/recipes/NutritionPanel'

export const Route = createFileRoute('/_app/foods/$foodId/')({
  component: FoodDetail,
})

function FoodDetail() {
  const { foodId } = Route.useParams()
  const food = useQuery(api.foods.get, { id: foodId as Id<'foods'> })
  const refreshFromOff = useAction(api.foodsLookup.refreshFromOff)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

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
            to="/foods/$foodId/edit"
            params={{ foodId }}
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
          <Link to="/foods/new" className="underline">
            Create your own food
          </Link>
          .
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
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
          disabled={refreshing}
          className="rounded border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          onClick={async () => {
            if (
              !window.confirm(
                'Overwrite this food with the latest data from Open Food Facts? Any local edits will be replaced.',
              )
            ) {
              return
            }
            setRefreshing(true)
            setError(null)
            try {
              await refreshFromOff({ id: food._id })
            } catch (err) {
              setError(
                err instanceof ConvexError
                  ? typeof err.data === 'string'
                    ? err.data
                    : 'Could not refresh from Open Food Facts'
                  : err instanceof Error
                    ? err.message
                    : 'Could not refresh from Open Food Facts',
              )
            } finally {
              setRefreshing(false)
            }
          }}
        >
          {refreshing ? 'Refreshing…' : 'Refresh from Open Food Facts'}
        </button>
      )}
    </article>
  )
}
