/**
 * What the house has in stock (APP-314), as a question a sheet can ask about
 * a name: the add-to-groceries sheet starts such a row unticked. One source
 * for every sheet that adds to the list: the recipe's now, the week menu's
 * (APP-321) when it lands.
 */
import { groceryKey, parseGroceryLine } from '@gather/core/groceries'
import { useMemo } from 'react'

import { api } from '../../../convex/api'
import { useQuery } from '../../../convex/queries'

/** The key a staple and a list item share: the name, amount taken off. */
export function stockKey(name: string): string {
  return groceryKey(parseGroceryLine(name).name)
}

/** A predicate over names; nothing is in stock until the staples load. */
export function inStockOf(
  staples: readonly { name: string; low: boolean }[] | undefined,
): (name: string) => boolean {
  const keys = new Set(
    (staples ?? [])
      .filter((staple) => !staple.low)
      .map((staple) => stockKey(staple.name)),
  )
  return (name) => keys.has(stockKey(name))
}

export function useInStock(groupSlug: string): (name: string) => boolean {
  const data = useQuery(api.groceryStaples.list, { groupSlug })
  return useMemo(() => inStockOf(data?.staples), [data])
}
