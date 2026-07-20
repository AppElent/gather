import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { mealValidator, quantityUnitValidator } from './lib/consumption'
import { nutritionSourceValidator, nutritionValidator } from './lib/nutrition'

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
    nutritionTargets: v.optional(nutritionValidator),
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
    spaceId: v.optional(v.id('spaces')),
    createdByUserId: v.optional(v.id('users')),
    ownerId: v.optional(v.id('users')),
    sharedGroupIds: v.optional(v.array(v.id('groups'))),
    title: v.string(),
    description: v.optional(v.string()),
    imageId: v.optional(v.id('_storage')),
    ingredients: v.array(v.string()),
    steps: v.array(v.string()),
    tags: v.array(v.string()),
    rating: v.optional(v.number()),
    prepMinutes: v.optional(v.number()),
    sourceUrl: v.optional(v.string()),
    servings: v.optional(v.number()),
    nutrition: v.optional(nutritionValidator),
    nutritionSource: v.optional(nutritionSourceValidator),
    nutritionStale: v.optional(v.boolean()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index('by_space', ['spaceId'])
    .index('by_owner', ['ownerId']),

  taskLists: defineTable({
    groupId: v.id('groups'),
    name: v.string(),
    provider: v.union(
      v.literal('local'),
      v.literal('notion'),
      v.literal('todoist'),
    ),
    providerConfig: v.optional(
      v.object({
        connectionId: v.id('integrationConnections'),
        sourceId: v.string(),
        propertyMapping: v.optional(
          v.object({
            title: v.string(),
            done: v.string(),
            dueDate: v.optional(v.string()),
            priority: v.optional(v.string()),
            labels: v.optional(v.string()),
          }),
        ),
      }),
    ),
    order: v.number(),
  }).index('by_group', ['groupId']),

  tasks: defineTable({
    listId: v.id('taskLists'),
    title: v.string(),
    done: v.boolean(),
    dueDate: v.optional(v.string()),
    priority: v.optional(
      v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4)),
    ),
    labels: v.optional(v.array(v.string())),
    createdBy: v.id('users'),
    order: v.number(),
  }).index('by_list', ['listId']),

  integrationConnections: defineTable({
    groupId: v.id('groups'),
    provider: v.union(v.literal('notion'), v.literal('todoist')),
    accessToken: v.string(),
    accountLabel: v.string(),
    connectedBy: v.id('users'),
  }).index('by_group_provider', ['groupId', 'provider']),

  foods: defineTable({
    name: v.string(),
    brand: v.optional(v.string()),
    barcode: v.optional(v.string()),
    baseUnit: v.union(v.literal('g'), v.literal('ml')),
    nutritionPer100: nutritionValidator,
    servingSize: v.optional(v.number()),
    servingLabel: v.optional(v.string()),
    source: v.union(v.literal('openfoodfacts'), v.literal('manual')),
    localEdited: v.optional(v.boolean()),
    createdBy: v.id('users'),
  })
    .index('by_barcode', ['barcode'])
    .searchIndex('search_by_name', { searchField: 'name' }),

  consumptionEntries: defineTable({
    userId: v.id('users'),
    date: v.string(),
    meal: mealValidator,
    recipeId: v.optional(v.id('recipes')),
    foodId: v.optional(v.id('foods')),
    label: v.string(),
    quantity: v.number(),
    quantityUnit: quantityUnitValidator,
    nutrition: nutritionValidator,
  }).index('by_user_date', ['userId', 'date']),
})
