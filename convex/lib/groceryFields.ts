import { GROCERY_AISLES } from '@gather/core/groceries'
import { v } from 'convex/values'
import { literals } from './validators'

/** One of the fixed aisles a grocery item can be in (`@gather/core/groceries`). */
export const groceryAisleValidator = literals(GROCERY_AISLES)

/** Where a shared cached aisle came from: the model, or Groups agreeing. */
export const groceryCacheSourceValidator = v.union(
  v.literal('ai'),
  v.literal('consensus'),
)
