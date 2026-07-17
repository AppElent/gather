import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const widgetInstance = v.object({
  instanceId: v.string(),
  widgetDefinitionId: v.string(),
  size: v.union(v.literal('compact'), v.literal('standard'), v.literal('wide')),
  config: v.optional(v.any()),
})

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
    defaultGroupId: v.optional(v.id('groups')),
  }).index('by_clerkId', ['clerkId']),

  groups: defineTable({
    name: v.string(),
    inviteCode: v.string(),
    type: v.optional(v.string()),
  }).index('by_inviteCode', ['inviteCode']),

  memberships: defineTable({
    groupId: v.id('groups'),
    userId: v.id('users'),
    role: v.union(v.literal('owner'), v.literal('member')),
  })
    .index('by_user', ['userId'])
    .index('by_group', ['groupId']),

  spaces: defineTable({
    clerkOrganizationId: v.string(),
    slug: v.string(),
    name: v.string(),
    status: v.union(v.literal('active'), v.literal('deleting')),
    defaultPinnedModuleIds: v.array(v.string()),
    defaultDashboard: v.array(widgetInstance),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_clerk_organization', ['clerkOrganizationId'])
    .index('by_slug', ['slug']),

  spaceMemberships: defineTable({
    spaceId: v.id('spaces'),
    userId: v.id('users'),
    clerkMembershipId: v.optional(v.string()),
    clerkUserId: v.string(),
    role: v.union(v.literal('admin'), v.literal('member')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_space', ['spaceId'])
    .index('by_user', ['userId'])
    .index('by_clerk_membership', ['clerkMembershipId'])
    .index('by_clerk_user', ['clerkUserId'])
    .index('by_space_user', ['spaceId', 'userId']),

  spaceModules: defineTable({
    spaceId: v.id('spaces'),
    moduleId: v.string(),
    state: v.union(
      v.literal('preEnabled'),
      v.literal('enabled'),
      v.literal('archived'),
    ),
    deletionStatus: v.optional(v.union(v.literal('pending'), v.literal('failed'))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_space', ['spaceId'])
    .index('by_space_module', ['spaceId', 'moduleId']),

  spacePreferences: defineTable({
    spaceId: v.id('spaces'),
    userId: v.id('users'),
    pinnedModuleIds: v.optional(v.array(v.string())),
    dashboard: v.optional(v.array(widgetInstance)),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_space_user', ['spaceId', 'userId']),

  recipes: defineTable({
    ownerId: v.id('users'),
    sharedGroupIds: v.array(v.id('groups')),
    title: v.string(),
    description: v.optional(v.string()),
    imageId: v.optional(v.id('_storage')),
    ingredients: v.array(v.string()),
    steps: v.array(v.string()),
    tags: v.array(v.string()),
    rating: v.optional(v.number()),
    prepMinutes: v.optional(v.number()),
    sourceUrl: v.optional(v.string()),
  }).index('by_owner', ['ownerId']),
})
