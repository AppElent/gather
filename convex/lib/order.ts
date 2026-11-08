/**
 * The next `order` among siblings. Counting them instead collides after a delete
 * (orders 0,1,2 -> delete 1 -> the next add gets 2 again), which makes sorting and
 * moving ambiguous between same-order rows.
 */
export function nextOrder(rows: readonly { order: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.order), -1) + 1
}
