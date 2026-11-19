/**
 * Convex HTTP routes, served on the deployment's `.convex.site` origin.
 *
 * `POST /clerk/webhook` (APP-397): Clerk tells Gather a login was deleted —
 * from any AppElent app or the Clerk dashboard — and Gather purges what it
 * holds for that person, exactly as deleting Gather's data in the app does
 * (`accounts.purgeDeletedClerkUser`, ADR-0050).
 *
 * The same route's `user.created` and `user.updated` (APP-388) mirror the
 * login's verified Sign in with Apple users into `appleSignInLinks`, which web
 * Apple revocation binds its code to (`accounts.revokeAppleSignIn`).
 *
 * Nothing is read from the body until its Svix signature checks out against
 * `CLERK_WEBHOOK_SECRET`. Without the secret the route refuses everything, so
 * a deployment that has not been given one cannot be told to delete anybody.
 * Other event types answer 200 so Clerk does not retry them.
 */
import { httpRouter } from 'convex/server'
import { internal } from './_generated/api'
import { httpAction } from './_generated/server'
import { verifiedAppleUserIds } from './lib/clerkUsers'
import { svixHeaders, verifySvix } from './lib/svix'

/** Far above any Clerk event; a bigger body is not one, and is not hashed. */
const MAX_BODY_BYTES = 256 * 1024

const clerkWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) {
    console.error('clerk webhook: CLERK_WEBHOOK_SECRET is not set')
    return new Response('Webhook not configured', { status: 503 })
  }

  const headers = svixHeaders(request.headers)
  if (!headers.id || !headers.timestamp || !headers.signature)
    return new Response('Missing signature', { status: 400 })

  const body = await request.text()
  if (body.length > MAX_BODY_BYTES)
    return new Response('Payload too large', { status: 413 })
  if (!(await verifySvix(secret, headers, body)))
    return new Response('Invalid signature', { status: 401 })

  let event: {
    type?: unknown
    data?: {
      id?: unknown
      updated_at?: unknown
      external_accounts?: unknown
    } | null
  } | null
  try {
    event = JSON.parse(body)
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }
  if (typeof event !== 'object' || event === null)
    return new Response('Invalid event', { status: 400 })

  if (event.type === 'user.deleted') {
    const subject = event.data?.id
    if (typeof subject !== 'string' || subject.length === 0)
      return new Response('Missing user id', { status: 400 })
    const rows = await ctx.runMutation(
      internal.accounts.purgeDeletedClerkUser,
      { subject },
    )
    // The Svix message id, not the subject: logs carry no person.
    console.log(
      `clerk webhook: user.deleted ${headers.id} purged ${rows} row(s)`,
    )
  }
  if (event.type === 'user.created' || event.type === 'user.updated') {
    const clerkId = event.data?.id
    const updatedAt = event.data?.updated_at
    if (typeof clerkId !== 'string' || clerkId.length === 0)
      return new Response('Missing user id', { status: 400 })
    // Without it an older delivery could overwrite a newer one.
    if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt))
      return new Response('Missing updated_at', { status: 400 })
    await ctx.runMutation(internal.accounts.syncAppleLink, {
      clerkId,
      appleUserIds: verifiedAppleUserIds(event.data ?? {}),
      clerkUpdatedAt: updatedAt,
    })
  }
  return new Response(null, { status: 200 })
})

const http = httpRouter()

http.route({
  path: '/clerk/webhook',
  method: 'POST',
  handler: clerkWebhook,
})

export default http
