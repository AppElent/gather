/**
 * Staples (APP-314, Groceries "In stock"): what a household always wants in
 * the house, each in stock or running low. The rules every writer shares:
 *
 * - a staple is found by its name's `groceryTitleKey`, the same key an item
 *   on a grocery list has, so "Melk" the staple and "Melk" with 2 `pak` on the
 *   list are one thing;
 * - running low puts it on the Group's grocery list, unless it is already
 *   open there;
 * - checking an item off on a grocery list puts a running-low staple with the
 *   same key back in stock. That runs inside the task mutations, so installed
 *   apps that know nothing of staples restock them too.
 */

import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { groceryTitleKey, isGroceryList } from './groceryCategories'

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

/** The keys of the open items on a list. */
export async function openKeysOn(
  ctx: QueryCtx,
  listId: Id<'taskLists'>,
): Promise<Set<string>> {
  const items = await ctx.db
    .query('tasks')
    .withIndex('by_list_and_done', (q) =>
      q.eq('listId', listId).eq('done', false),
    )
    .collect()
  return new Set(items.map((item) => groceryTitleKey(item.title)))
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
 * Put a staple on the Group's grocery list, at the end, unless an open item
 * with its key is already there. Answers whether it is on the list now.
 */
export async function putStapleOnList(
  ctx: MutationCtx,
  group: Doc<'groups'>,
  staple: Doc<'groceryStaples'>,
  userId: Id<'users'>,
): Promise<boolean> {
  const list = await writableGroceryList(ctx, group)
  if (!list) return false
  if ((await openKeysOn(ctx, list._id)).has(staple.key)) return true
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
