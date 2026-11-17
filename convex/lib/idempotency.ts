/**
 * Idempotency keys for creates (ADR-0046).
 *
 * A connected app retries a create when it lost the answer, and without a key
 * every retry is another recipe, task, note or event. A create that takes an
 * optional `idempotencyKey` looks it up after authorising and before writing:
 * a known key returns the row it made the first time and writes nothing.
 *
 * Keys are per person. A key reused for a different kind of row is refused
 * rather than answered with an id from another table.
 */
import { ConvexError, v } from 'convex/values'
import type { Id, TableNames } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

export const idempotencyKeyValidator = v.optional(v.string())

export const IDEMPOTENCY_KEY_REUSED =
  'That idempotencyKey was already used for a different write.'

/**
 * Run `create` once per `(user, key)`. Without a key it simply runs.
 * Call it after the caller is authorised, so a replay never answers someone
 * who could not have made the write.
 */
export async function createOnce<T extends TableNames>(
  ctx: MutationCtx,
  userId: Id<'users'>,
  table: T,
  key: string | undefined,
  create: () => Promise<Id<T>>,
): Promise<Id<T>> {
  if (key === undefined) return await create()
  if (key.length < 8 || key.length > 100)
    throw new ConvexError('idempotencyKey must be 8 to 100 characters.')
  const prior = await ctx.db
    .query('idempotencyKeys')
    .withIndex('by_user_and_key', (q) => q.eq('userId', userId).eq('key', key))
    // `first`, not `unique`: merging duplicate accounts may leave two rows.
    .first()
  if (prior) {
    if (prior.table !== table) throw new ConvexError(IDEMPOTENCY_KEY_REUSED)
    return prior.docId as Id<T>
  }
  const id = await create()
  await ctx.db.insert('idempotencyKeys', { userId, key, table, docId: id })
  return id
}
