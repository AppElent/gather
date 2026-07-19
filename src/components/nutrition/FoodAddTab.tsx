import { Link } from '@tanstack/react-router'
import { useAction, useConvex, useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import {
  computeFoodEntryNutrition,
  type MealName,
} from '../../../convex/lib/consumption'
import type { NutritionFacts } from '../../../convex/lib/nutrition'
import { BarcodeScanner } from '../foods/BarcodeScanner'

// _id is typed as the branded Id<'foods'>, not a plain string, because this
// state is always populated directly from real Convex query results
// (getByBarcode / get / search) — never round-tripped through a URL param —
// and createEntry's foodId arg requires Id<'foods'>, not string.
interface FoodSummary {
  _id: Id<'foods'>
  name: string
  baseUnit: 'g' | 'ml'
  nutritionPer100: NutritionFacts
  servingSize?: number
}

interface Props {
  date: string
  meal: MealName
  onAdded: () => void
}

export function FoodAddTab({ date, meal, onAdded }: Props) {
  const [term, setTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebouncedTerm(term), 250)
    return () => clearTimeout(id)
  }, [term])
  const results = useQuery(api.foods.search, { term: debouncedTerm })

  const [selected, setSelected] = useState<FoodSummary | null>(null)
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [quantityInput, setQuantityInput] = useState('')
  const [unit, setUnit] = useState<'g' | 'ml' | 'piece'>('g')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const convex = useConvex()
  const lookupBarcode = useAction(api.foodsLookup.lookupBarcode)
  const upsertFromOff = useMutation(api.foods.upsertFromOff)
  const createEntry = useMutation(api.consumption.create)

  async function handleDetected(barcode: string) {
    if (resolving) return
    setResolving(true)
    setNotFoundBarcode(null)
    setLookupError(null)
    try {
      const existing = await convex.query(api.foods.getByBarcode, { barcode })
      if (existing) {
        setSelected(existing)
        setUnit(existing.baseUnit)
        return
      }
      const mapped = await lookupBarcode({ barcode })
      if (!mapped) {
        setNotFoundBarcode(barcode)
        return
      }
      const id = await upsertFromOff({
        barcode,
        name: mapped.name,
        brand: mapped.brand,
        baseUnit: 'g',
        nutritionPer100: mapped.nutritionPer100,
        servingSize: mapped.servingSize,
        servingLabel: mapped.servingLabel,
      })
      const saved = await convex.query(api.foods.get, { id })
      if (saved) {
        setSelected(saved)
        setUnit(saved.baseUnit)
      }
    } catch {
      setLookupError("Couldn't look up that barcode — try again.")
    } finally {
      setResolving(false)
    }
  }

  if (selected) {
    return (
      <div className="grid gap-2 text-sm">
        <p className="font-medium">{selected.name}</p>
        <div className="flex items-center gap-2">
          <input
            inputMode="decimal"
            value={quantityInput}
            onChange={(e) => setQuantityInput(e.target.value)}
            className="w-20 rounded border border-[var(--app-border)] px-1 py-0.5"
            placeholder="0"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as 'g' | 'ml' | 'piece')}
            className="rounded border border-[var(--app-border)] px-1 py-0.5"
          >
            <option value={selected.baseUnit}>{selected.baseUnit}</option>
            {selected.servingSize !== undefined && (
              <option value="piece">
                piece ({selected.servingSize}
                {selected.baseUnit})
              </option>
            )}
          </select>
        </div>
        {submitError && (
          <p className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-800">
            {submitError}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="rounded border px-2 py-1 text-xs"
          >
            Back
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={async () => {
              const quantity = Number(quantityInput.replace(',', '.'))
              if (!Number.isFinite(quantity) || quantity <= 0) return
              setSubmitting(true)
              setSubmitError(null)
              try {
                await createEntry({
                  date,
                  meal,
                  foodId: selected._id,
                  label: selected.name,
                  quantity,
                  quantityUnit: unit,
                  nutrition: computeFoodEntryNutrition(
                    selected,
                    quantity,
                    unit,
                  ),
                })
                onAdded()
              } catch (err) {
                setSubmitError(
                  err instanceof Error
                    ? err.message
                    : 'Could not log this food',
                )
              } finally {
                setSubmitting(false)
              }
            }}
            className="rounded border border-[var(--app-fg)] bg-[var(--app-fg)] px-3 py-1 text-xs font-semibold text-[var(--app-surface)] disabled:opacity-60"
          >
            Add
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <BarcodeScanner onDetected={handleDetected} />
      {resolving && <p className="text-xs opacity-60">Looking up…</p>}
      {lookupError && <p className="text-xs text-red-700">{lookupError}</p>}
      {notFoundBarcode && (
        <p className="text-xs opacity-60">
          Not found.{' '}
          <Link
            to="/foods/new"
            search={{ barcode: notFoundBarcode }}
            className="underline"
          >
            Add it to the foods library
          </Link>{' '}
          first.
        </p>
      )}
      <input
        className="w-full rounded border border-[var(--app-border)] px-2 py-1 text-sm"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search foods…"
      />
      <ul className="max-h-48 divide-y divide-[var(--app-border)] overflow-y-auto">
        {results?.map((food) => (
          <li key={food._id}>
            <button
              type="button"
              onClick={() => {
                setSelected(food)
                setUnit(food.baseUnit)
              }}
              className="block w-full py-1.5 text-left text-sm"
            >
              {food.name}
              {food.brand && (
                <span className="ml-2 opacity-60">{food.brand}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
