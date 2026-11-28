/**
 * Staples (APP-314, Groceries "In stock"): what a household always wants in
 * the house, each in stock or running low. The rules every writer shares:
 *
 * - a staple is found by its name's `groceryTitleKey`, the same key an item
 *   on a grocery list has, so "Melk" the staple and "Melk" with 2 `pak` on the
 *   list are one thing;
 * - running low puts it on the Group's grocery list, unless it is already
 *   on the list today. A repeating item with its key that waits for its next
 *   date (APP-520) is brought forward to today instead of added twice
 *   (APP-989);
 * - checking an item off on a grocery list puts a running-low staple with the
 *   same key back in stock. That runs inside the task mutations, so installed
 *   apps that know nothing of staples restock them too.
 */

import { onShoppingList, waitsToRepeat } from '@gather/core/grocery-list'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import {
  groceryTitleKey,
  isGroceryList,
  OPEN_ITEMS_SCAN_LIMIT,
} from './groceryCategories'
import { shiftSubtaskDates } from './subtasks'
import { completionDay, movedDays, moveReminder } from './taskRepeat'

/** The longest staple name a Member may type. */
export const STAPLE_NAME_MAX = 200

export function stapleKey(name: string): string {
  return groceryTitleKey(name)
}

export async function findStaple(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  key: string,
) {
  return await ctx.db
    .query('groceryStaples')
    .withIndex('by_group_and_key', (q) =>
      q.eq('groupId', groupId).eq('key', key),
    )
    .first()
}

/**
 * The open items on a list. Reads at most `OPEN_ITEMS_SCAN_LIMIT` open items,
 * far beyond any real shopping list, so the read stays bounded
 * (`docs/standards/convex.md`, APP-428).
 */
async function openItemsOn(ctx: QueryCtx, listId: Id<'taskLists'>) {
  return await ctx.db
    .query('tasks')
    .withIndex('by_list_and_done', (q) =>
      q.eq('listId', listId).eq('done', false),
    )
    .take(OPEN_ITEMS_SCAN_LIMIT)
}

/**
 * The keys of the items on a grocery list today. A repeating item that waits
 * off the list for its next date (APP-520) is not among them: nobody sees it
 * there (APP-989). `today` is the Group's calendar day.
 */
export async function openKeysOn(
  ctx: QueryCtx,
  listId: Id<'taskLists'>,
  today: string,
): Promise<Set<string>> {
  const items = await openItemsOn(ctx, listId)
  return new Set(
    items
      .filter((item) => onShoppingList(item, today))
      .map((item) => groceryTitleKey(item.title)),
  )
}

/** The Group's calendar day, as the server knows it. */
export function groupToday(group: Doc<'groups'>): string {
  return completionDay(undefined, group.timeZone)
}

/**
 * The Group's grocery list when Gather can write to it: the list the
 * Groceries Module opens, local, and still in the Group.
 */
export async function writableGroceryList(
  ctx: QueryCtx,
  group: Doc<'groups'>,
): Promise<Doc<'taskLists'> | null> {
  if (!group.groceryListId) return null
  const list = await ctx.db.get(group.groceryListId)
  if (!list || list.groupId !== group._id || list.provider !== 'local')
    return null
  return list
}

/**
 * Bring a repeating grocery item that waits off the list for its next date
 * (APP-520) forward to `today`, the Group's calendar day, so the list shows
 * it again. Its reminder and dated subtasks move with it, as when it is
 * completed; its repeat keeps its schedule. An item on the list today is left
 * as it is. Answers whether it moved.
 */
export async function bringForward(
  ctx: MutationCtx,
  group: Doc<'groups'>,
  item: Doc<'tasks'>,
  today: string,
): Promise<boolean> {
  if (!waitsToRepeat(item, today)) return false
  await ctx.db.patch(item._id, { dueDate: today })
  await moveReminder(ctx, item, group._id, today)
  await shiftSubtaskDates(
    ctx,
    item._id,
    group._id,
    movedDays(item.dueDate, today),
  )
  return true
}

/**
 * Put a staple on the Group's grocery list, at the end, unless an item with
 * its key is on the list today. A repeating item with its key that waits for
 * its next date is brought forward to today, so the list shows the one item
 * rather than a second copy (APP-989); its reminder and dated subtasks move
 * with it, as when it is completed. Answers whether it is on the list now.
 */
export async function putStapleOnList(
  ctx: MutationCtx,
  group: Doc<'groups'>,
  staple: Doc<'groceryStaples'>,
  userId: Id<'users'>,
): Promise<boolean> {
  const list = await writableGroceryList(ctx, group)
  if (!list) return false
  const today = groupToday(group)
  const same = (await openItemsOn(ctx, list._id)).filter(
    (item) => groceryTitleKey(item.title) === staple.key,
  )
  if (same.some((item) => onShoppingList(item, today))) return true
  const waiting = same.find((item) => waitsToRepeat(item, today))
  if (waiting) {
    await bringForward(ctx, group, waiting, today)
    return true
  }
  const last = await ctx.db
    .query('tasks')
    .withIndex('by_list_and_order', (q) => q.eq('listId', list._id))
    .order('desc')
    .first()
  await ctx.db.insert('tasks', {
    listId: list._id,
    title: staple.name,
    done: false,
    createdBy: userId,
    order: last ? last.order + 1 : 0,
    category: staple.aisle,
  })
  return true
}

/**
 * After items were checked off on a list: each running-low staple of the
 * Group with the same key is back in stock. Only on grocery lists; anything
 * else, and items left open, change nothing.
 */
export async function restockCheckedStaples(
  ctx: MutationCtx,
  group: Doc<'groups'>,
  list: Pick<Doc<'taskLists'>, '_id' | 'kind'>,
  checked: readonly Pick<Doc<'tasks'>, 'title'>[],
) {
  if (checked.length === 0 || !isGroceryList(group, list)) return
  const keys = new Set(checked.map((item) => groceryTitleKey(item.title)))
  for (const key of keys) {
    if (!key) continue
    const staple = await findStaple(ctx, group._id, key)
    if (staple?.low) await ctx.db.patch(staple._id, { low: false })
  }
}
