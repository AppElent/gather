'use node'

import { createClerkClient } from '@clerk/backend'
import { verifyWebhook } from '@clerk/backend/webhooks'
import { internal } from './_generated/api'
import { httpAction } from './_generated/server'
import {
  extractClerkProjectionContext,
  normalizeClerkEvent,
  type ClerkProjectionContext,
  type ClerkProjectionEvent,
} from './lib/clerkEvents'
import { isGatherOrganizationMetadata } from '../shared/gatherOrganizations'

export type ClerkWebhookDependencies = {
  verify: (request: Request) => Promise<any>
  classify: (event: any) => Promise<ClerkProjectionEvent | null>
  apply: (
    event: ClerkProjectionEvent,
    context?: ClerkProjectionContext,
  ) => Promise<unknown>
}

type ClassifierContext = {
  hasSpace: (clerkOrganizationId: string) => Promise<boolean>
  hasMembership: (clerkMembershipId: string) => Promise<boolean>
  userHasMembership: (clerkUserId: string) => Promise<boolean>
  getOrganization: (
    clerkOrganizationId: string,
  ) => Promise<{ publicMetadata: unknown } | null>
}

export async function classifyClerkEvent(
  ctx: ClassifierContext,
  verifiedEvent: any,
): Promise<ClerkProjectionEvent | null> {
  const type = verifiedEvent?.type
  const data = verifiedEvent?.data ?? {}
  const normalized = normalizeClerkEvent(verifiedEvent)

  if (type === 'organization.deleted') {
    return (await ctx.hasSpace(data.id)) ? normalized : null
  }

  if (type === 'user.created' || type === 'user.updated') {
    return (await ctx.userHasMembership(data.id)) ? normalized : null
  }

  if (
    type === 'organizationMembership.created' ||
    type === 'organizationMembership.updated'
  ) {
    if (!normalized || normalized.kind !== 'membership.upsert') return null
    if (await ctx.hasSpace(normalized.clerkOrganizationId)) return normalized

    const organization = await ctx.getOrganization(normalized.clerkOrganizationId)
    return organization && isGatherOrganizationMetadata(organization.publicMetadata)
      ? normalized
      : null
  }

  if (type === 'organizationMembership.deleted') {
    if (!normalized || normalized.kind !== 'membership.delete') return null
    return (await ctx.hasMembership(normalized.clerkMembershipId)) ||
      (await ctx.hasSpace(data.organization?.id))
      ? normalized
      : null
  }

  return normalized
}

export async function handleClerkWebhook(
  request: Request,
  dependencies: ClerkWebhookDependencies,
): Promise<Response> {
  let event: any
  try {
    event = await dependencies.verify(request)
  } catch {
    return new Response('invalid webhook', { status: 400 })
  }

  try {
    const normalized = await dependencies.classify(event)
    if (normalized) {
      await dependencies.apply(normalized, extractClerkProjectionContext(event))
    }
    return new Response('ok', { status: 200 })
  } catch {
    return new Response('webhook processing failed', { status: 500 })
  }
}

export const clerkWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET
  return await handleClerkWebhook(request, {
    verify: async (incoming) => {
      if (!secret) throw new Error('CLERK_WEBHOOK_SIGNING_SECRET is required')
      return await verifyWebhook(incoming, { signingSecret: secret })
    },
    classify: async (event) =>
      await classifyClerkEvent(
        {
          hasSpace: async (clerkOrganizationId) =>
            await ctx.runQuery((internal as any).clerkSync.hasSpace, {
              clerkOrganizationId,
            }),
          hasMembership: async (clerkMembershipId) =>
            await ctx.runQuery((internal as any).clerkSync.hasMembership, {
              clerkMembershipId,
            }),
          userHasMembership: async (clerkUserId) =>
            await ctx.runQuery((internal as any).clerkSync.userHasMembership, {
              clerkUserId,
            }),
          getOrganization: async (clerkOrganizationId) => {
            const secretKey = process.env.CLERK_SECRET_KEY
            if (!secretKey) throw new Error('CLERK_SECRET_KEY is required')
            const clerk = createClerkClient({ secretKey })
            try {
              const organization = await clerk.organizations.getOrganization({
                organizationId: clerkOrganizationId,
              })
              return { publicMetadata: organization.publicMetadata }
            } catch (error) {
              if (isClerkNotFound(error)) return null
              throw error
            }
          },
        },
        event,
      ),
    apply: async (event, context) =>
      await ctx.runMutation((internal as any).clerkSync.apply, { event, context }),
  })
})

function isClerkNotFound(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const value = error as { status?: unknown; statusCode?: unknown; errors?: unknown }
  if (value.status === 404 || value.statusCode === 404) return true
  if (!Array.isArray(value.errors)) return false
  return value.errors.some((entry) => {
    if (!entry || typeof entry !== 'object') return false
    const code = (entry as { code?: unknown }).code
    return code === 'resource_not_found' || code === 'not_found'
  })
}
