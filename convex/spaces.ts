import { v } from 'convex/values'
import { query } from './_generated/server'
import { requireActiveSpace } from './lib/spaceAuth'

export const context = query({
  args: { spaceSlug: v.string() },
  handler: async (ctx, args) => {
    const { space, role, user } = await requireActiveSpace(ctx, args)
    return { space, role, user }
  },
})
