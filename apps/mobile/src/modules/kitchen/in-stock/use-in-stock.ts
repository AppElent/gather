/**
 * What the house has in stock (APP-314), as a question a sheet can ask about
 * a name: the add-to-groceries sheet starts such a row unticked. One source
 * for every sheet that adds to the list: the recipe's now, the week menu's
 * (APP-321) when it lands.
 */
import { inStockOf } from '@gather/core/grocery-list'
import { useMemo } from 'react'

import { api } from '../../../convex/api'
import { useQuery } from '../../../convex/queries'

export function useInStock(groupSlug: string): (name: string) => boolean {
  const data = useQuery(api.groceryStaples.list, { groupSlug })
  return useMemo(() => inStockOf(data?.staples), [data])
}
