import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

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
  }).index('by_owner', ['ownerId']),
})
