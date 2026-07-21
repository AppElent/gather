import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { babyEventDataValidator, babyEventTypeValidator } from './lib/babyEvents'
import { mealValidator, quantityUnitValidator } from './lib/consumption'
import { nutritionSourceValidator, nutritionValidator } from './lib/nutrition'

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
    servings: v.optional(v.number()),
    nutrition: v.optional(nutritionValidator),
    nutritionSource: v.optional(nutritionSourceValidator),
    nutritionStale: v.optional(v.boolean()),
  }).index('by_owner', ['ownerId']),

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
        sourceId: v.string(), // Notion database id / Todoist project id
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

  // Rows exist only for provider === 'local' lists.
  tasks: defineTable({
    listId: v.id('taskLists'),
    title: v.string(),
    done: v.boolean(),
    dueDate: v.optional(v.string()), // ISO date, YYYY-MM-DD
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
    accessToken: v.string(), // server-only; never returned by a public function
    accountLabel: v.string(), // Notion workspace name / 'Todoist'
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

  babies: defineTable({
    groupId: v.id('groups'),
    name: v.string(),
    birthDate: v.string(), // ISO YYYY-MM-DD
    sex: v.optional(
      v.union(v.literal('female'), v.literal('male'), v.literal('unspecified')),
    ),
    photoId: v.optional(v.id('_storage')),
    order: v.number(),
  }).index('by_group', ['groupId']),

  babyEvents: defineTable({
    babyId: v.id('babies'),
    type: babyEventTypeValidator,
    timestamp: v.number(), // epoch ms, when the event occurred
    endTimestamp: v.optional(v.number()), // sleep/feeding session duration
    notes: v.optional(v.string()),
    loggedBy: v.id('users'),
    data: babyEventDataValidator,
  })
    .index('by_baby', ['babyId'])
    .index('by_baby_type', ['babyId', 'type']),
})
