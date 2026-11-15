/**
 * The Loyalty cards API's shapes, as the phone reads them (APP-141's
 * `convex/loyaltyCards.ts`). Derived from the functions rather than imported,
 * because the phone reaches `convex/` only through `src/convex/api.ts`.
 */
import type { FunctionReturnType } from 'convex/server'

import type { api } from '../../convex/api'

/** A card in the list, without photo URLs. */
export type ListedCard = FunctionReturnType<
  typeof api.loyaltyCards.list
>[number]

/** One card with its photos. */
export type CardDetail = NonNullable<
  FunctionReturnType<typeof api.loyaltyCards.get>
>

/** A Retailer catalog entry, as the picker reads it. */
export type Retailer = FunctionReturnType<
  typeof api.loyaltyCards.searchCatalog
>[number]
