'use node'

import { verifyWebhook } from '@clerk/backend/webhooks'
import { v } from 'convex/values'
import { internalAction } from './_generated/server'

/** Svix signature verification is the only Node-runtime dependency of the
 * Clerk webhook. It lives here on its own because a `'use node'` module may
 * only export actions — the httpAction itself has to stay in the default
 * runtime (see convex/clerkWebhook.ts). */
export const verifyClerkWebhook = internalAction({
  args: {
    body: v.string(),
    svixId: v.string(),
    svixTimestamp: v.string(),
    svixSignature: v.string(),
  },
  handler: async (_ctx, args) => {
    const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET
    if (!secret) throw new Error('CLERK_WEBHOOK_SIGNING_SECRET is required')
    const request = new Request('https://clerk.invalid/webhook', {
      method: 'POST',
      headers: {
        'svix-id': args.svixId,
        'svix-timestamp': args.svixTimestamp,
        'svix-signature': args.svixSignature,
      },
      body: args.body,
    })
    return await verifyWebhook(request, { signingSecret: secret })
  },
})
