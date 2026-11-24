import { GROCERY_AISLES, GROCERY_UNITS } from '@gather/core/groceries'
import { v } from 'convex/values'
import { literals } from './validators'

/** One of the fixed aisles a grocery item can be in (`@gather/core/groceries`). */
export const groceryAisleValidator = literals(GROCERY_AISLES)

/** One of the fixed units a grocery item's amount is in (APP-309). */
export const groceryUnitValidator = literals(GROCERY_UNITS)

/** A grocery item's whole amount; null is a part it does not have. */
export const groceryAmountValidator = v.object({
  quantity: v.union(v.number(), v.null()),
  unit: v.union(groceryUnitValidator, v.null()),
})

/** Where a shared cached aisle came from: the model, or Groups agreeing. */
export const groceryCacheSourceValidator = v.union(
  v.literal('ai'),
  v.literal('consensus'),
)
