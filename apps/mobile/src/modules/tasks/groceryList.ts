/**
 * How a grocery list is laid out: `@gather/core/grocery-list`, shared with the
 * web, plus what only the phone's Reorder mode draws (APP-522).
 */
import { aisleOrder } from '@gather/core/groceries'
import { aisleOf } from '@gather/core/grocery-list'
import { headingKey } from './sectionArrange'

export * from '@gather/core/grocery-list'

/**
 * Reorder mode's column on a grocery list (APP-522): every aisle's heading in
 * the list's aisle order, each followed by its items in their order. An empty
 * aisle keeps its heading, so an item can be dragged into it; there is no
 * "No section", because an item without an aisle is under Other.
 */
export function aisleArrangement(
  tasks: readonly { id: string; category?: string }[],
  order?: readonly string[] | null,
): string[] {
  return aisleOrder(order).flatMap((aisle) => [
    headingKey(aisle),
    ...tasks.filter((task) => aisleOf(task) === aisle).map((task) => task.id),
  ])
}
