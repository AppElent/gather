import { useAction, useConvex } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '../../../convex/_generated/api'
import type { OffSearchResult } from '../../../convex/lib/offMapping'
import type { FoodFormValues } from './FoodForm'

/** A food as the foods queries hand it over: the row, its picture, `canEdit`. */
export type FoodRead = NonNullable<FunctionReturnType<typeof api.foods.get>>

/** What a scanned or typed barcode turned out to be. */
export type BarcodeMatch =
  | { kind: 'food'; food: FoodRead }
  | { kind: 'product'; product: OffSearchResult }
  | { kind: 'none' }

/**
 * Resolving a barcode: a food somebody already has first, Open Food Facts
 * only after that. A product you already have is not an import, and asking in
 * this order is what keeps an import from overwriting it.
 */
export function useBarcodeLookup() {
  const convex = useConvex()
  const lookupBarcode = useAction(api.foodsLookup.lookupBarcode)
  return async (barcode: string): Promise<BarcodeMatch> => {
    const food = await convex.query(api.foods.getByBarcode, { barcode })
    if (food) return { kind: 'food', food }
    const mapped = await lookupBarcode({ barcode })
    return mapped
      ? { kind: 'product', product: { ...mapped, barcode } }
      : { kind: 'none' }
  }
}

/**
 * An Open Food Facts product as a food, before anybody has reviewed it.
 *
 * Open Food Facts supplies figures per 100g and no reliable unit signal, so
 * the unit is grams until the person says otherwise. The figures are
 * `imported` until somebody types over one.
 */
export function offFoodValues(
  product: OffSearchResult,
): FoodFormValues & { barcode: string } {
  return {
    barcode: product.barcode,
    name: product.name,
    brand: product.brand,
    baseUnit: 'g',
    nutritionPer100: product.nutritionPer100,
    ...(product.servings?.length ? { servings: product.servings } : {}),
    nutritionSource: 'imported',
  }
}
