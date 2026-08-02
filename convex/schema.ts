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
    // Where Pins used to live, back when one person had one set of them for
    // every Group at once. They are per Group now and live on the membership
    // row below (ADR-0004); nothing writes this field any more.
    //
    // It is still read, as the seed for a Group somebody has not chosen pins
    // in — which is what lets the change land without a backfill and without
    // anyone signing in to find their navigation reset. The contract half of
    // expand–contract: droppable once every membership carries its own list.
    pinnedModuleIds: v.optional(v.array(v.string())),
  }).index('by_clerkId', ['clerkId']),

  groups: defineTable({
    name: v.string(),
    inviteCode: v.string(),
    // Globally unique, and readable so that the Group you are acting in is
    // visible in the URL (ADR-0002).
    slug: v.string(),
    // A Personal group has one Member and cannot be left, renamed or deleted.
    isPersonal: v.boolean(),
  })
    .index('by_inviteCode', ['inviteCode'])
    .index('by_slug', ['slug']),

  memberships: defineTable({
    groupId: v.id('groups'),
    userId: v.id('users'),
    role: v.union(v.literal('admin'), v.literal('member')),
    // The Modules this person keeps in *this* Group's navigation, in their own
    // order (ADR-0004). A membership is already exactly one person in one
    // Group, so the pair needs no table of its own — and a Pin then has the
    // lifetime it should: leave the Group and your choices for it go with the
    // row, instead of outliving your access to the place they described.
    //
    // Still one person's choice and still invisible to the rest of the Group.
    // What changed is that a wine club and a household are different rooms, and
    // the Modules worth reaching first differ between them.
    //
    // Opaque strings, deliberately: the Module catalog is a client concept and
    // this schema must not know it. Absent means "has not chosen in this
    // Group", which falls back to the person's pre-ADR-0004 list and then to
    // the default defined in code; an empty array means "chose to keep none".
    pinnedModuleIds: v.optional(v.array(v.string())),
  })
    .index('by_user', ['userId'])
    .index('by_group', ['groupId']),

  recipes: defineTable({
    // A recipe belongs to a Group, not to whoever typed it in. `groupId` is the
    // home Group; `sharedGroupIds` are the further Groups it is visible in and
    // never contains `groupId`. `createdByUserId` is attribution — it records
    // who added the recipe and confers no ownership and no access (CONTEXT.md).
    // All three are required: an optional ownership field is a schema that has
    // stopped saying who owns the row.
    groupId: v.id('groups'),
    sharedGroupIds: v.array(v.id('groups')),
    createdByUserId: v.id('users'),
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
  }).index('by_group', ['groupId']),

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
    // Lazily created by babies.ensureTodoList / ensureQuestionsList — the
    // to-do and questions cards on the baby detail page are just local
    // taskLists, reusing the Tasks module instead of parallel concepts.
    taskListId: v.optional(v.id('taskLists')),
    questionsListId: v.optional(v.id('taskLists')),
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
