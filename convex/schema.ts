import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { babyEventDataValidator, babyEventTypeValidator } from './lib/babyEvents'
import { mealValidator, quantityUnitValidator } from './lib/consumption'
import { nutritionSourceValidator, nutritionValidator } from './lib/nutrition'
import { servingValidator } from './lib/servings'

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
    // row below (ADR-0005); nothing writes this field any more.
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
    // order (ADR-0005). A membership is already exactly one person in one
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
    // Group", which falls back to the person's pre-ADR-0005 list and then to
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
    // What somebody calls a portion of this food, in order — "1 slice",
    // "1 glass" — each an amount in `baseUnit`. Optional because most foods
    // have none: an empty list is answered by the person's own logged amounts
    // rather than by inventing a portion for them.
    servings: v.optional(v.array(servingValidator)),
    source: v.union(
      v.literal('openfoodfacts'),
      v.literal('manual'),
      v.literal('seed'),
    ),
    // Where the *figures* came from, which is a different question from where
    // the *row* came from (`source`, above): a food somebody added by hand can
    // later be corrected off a packet, and an imported row can be typed over.
    // Conflating the two loses both answers.
    //
    // The same union Recipes carry, rather than a second, finer vocabulary
    // meaning nearly the same thing: an Open Food Facts record is `imported`,
    // a model's guess is `ai`, typed figures are `manual`.
    //
    // Optional, and nothing backfills it — a food that predates the field
    // simply does not claim a source. Absent on Catalog rows too: their
    // figures are authored, and "Built-in" already says so.
    nutritionSource: v.optional(nutritionSourceValidator),
    localEdited: v.optional(v.boolean()),
    // Absent on Catalog entries — seeded reference data is owned by nobody
    // (CONTEXT.md, "Catalog"). Present on every row a person created.
    createdBy: v.optional(v.id('users')),
    // Stable identity for a Catalog entry across re-seeds. Absent on
    // user-created rows, which the seed must never touch. See ADR 0004.
    seedKey: v.optional(v.string()),
    // Name and brand as one field, because a search index has exactly one
    // full-text field and a brand on the carton has to match (see
    // `lib/foodSearchText.ts`). Optional only until the backfill has run
    // everywhere — docs/migrations/0005 says what makes it required.
    searchText: v.optional(v.string()),
    // The product's own picture, fetched from Open Food Facts at import and
    // stored here so it does not depend on their servers later. Never a
    // photograph a person took: that would need the prepare-on-upload pipeline
    // (ADR-0010) and is deliberately not offered.
    imageId: v.optional(v.id('_storage')),
    // An emoji somebody picked, for a food with no picture behind it (#94).
    // Content, not a display string, so it is stored rather than translated
    // (ADR-0011) — exactly like a serving's `label`. Optional and nothing
    // backfills it: a food with none renders the generic glyph it always did.
    // A tile prefers the photograph, then this, then that glyph.
    icon: v.optional(v.string()),
  })
    .index('by_barcode', ['barcode'])
    .index('by_seedKey', ['seedKey'])
    // Browsing reads a page of the Catalog in name order. Without this the
    // page would be whatever the table happened to hand back and only then be
    // sorted, which is not the first page alphabetically the moment there are
    // more foods than fit on one (#100 review).
    .index('by_name', ['name'])
    .searchIndex('search_by_text', { searchField: 'searchText' }),

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
    // An emoji, for a **one-off** — an entry with no `foodId` and no
    // `recipeId`, which has nothing to inherit a picture from and never will
    // (#94). An entry that does reference a food reads the food's own icon
    // instead, so this stays absent there. Content, not a display string.
    icon: v.optional(v.string()),
    // Which Combo wrote this entry, and what that Combo was called when it
    // did (#99). Absent on everything logged one thing at a time.
    //
    // Both, and for the reason the entry already keeps a `label` beside its
    // `foodId`: a Personal record snapshots what it references, and its
    // provenance is allowed to dangle (ADR-0003). The name is therefore the
    // name at the time — renaming a Combo does not rewrite last Tuesday, and
    // deleting one does not blank what it left behind. The id is what makes
    // two Combos that happen to share a name still two Combos.
    comboId: v.optional(v.id('combos')),
    comboLabel: v.optional(v.string()),
  })
    .index('by_user_date', ['userId', 'date'])
    // "Which amounts of this food have I logged before?" — read to offer them
    // back as servings, and the reason this is an index rather than a scan of
    // every entry the person has ever written.
    .index('by_user_food', ['userId', 'foodId']),

  /**
   * A named, reusable set of things logged together — the same lunch, again
   * (ADR-0012).
   *
   * **Personal** in the sense of ADR-0003: it belongs to a person, follows
   * them into every Group and belongs to none, which is why there is a
   * `userId` here and no `groupId` anywhere near it.
   */
  combos: defineTable({
    userId: v.id('users'),
    name: v.string(),
    order: v.number(),
  }).index('by_user', ['userId']),

  /**
   * One thing inside a Combo — exactly a diary entry minus the date, the meal
   * and the person.
   *
   * **References, not figures**: `foodId` / `recipeId` say what this is, so
   * correcting a food's nutrition corrects every future log of every Combo
   * containing it. `label` is a snapshot so a reference that has become
   * unreachable still has something to render, and `nutrition` is present only
   * for a one-off, which has nothing behind it to read figures from.
   */
  comboItems: defineTable({
    comboId: v.id('combos'),
    foodId: v.optional(v.id('foods')),
    recipeId: v.optional(v.id('recipes')),
    label: v.string(),
    quantity: v.number(),
    quantityUnit: quantityUnitValidator,
    nutrition: v.optional(nutritionValidator),
    // Kept for the same reason as the figures beside it, and only on the same
    // rows: a one-off has no food and no recipe to read an icon back from, so
    // a Combo that does not carry its own would lose it on every future log
    // (#94).
    icon: v.optional(v.string()),
  }).index('by_combo', ['comboId']),

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

  // Bookkeeping for the Sample household seed, which wipes and recreates on
  // every run: one row per run, listing exactly the documents that run
  // created so the next one can remove those and nothing else. Deliberately
  // not a marker field on every table — a new module contributes sample data
  // without touching its own schema.
  //
  // The Catalog seed never writes here; it reconciles by `seedKey` instead.
  seedRuns: defineTable({
    label: v.string(),
    createdAt: v.number(),
    // Raw document ids spanning many tables. `db.delete` resolves the table
    // from the id itself, so one flat list is enough and stays open-ended.
    documentIds: v.array(v.string()),
    // Where the owner's default Group pointed before the run took it over,
    // so a reset can put it back instead of leaving the account with no
    // default at all — which breaks Tasks and Baby until they visit Groups.
    restoreDefaultGroup: v.optional(
      v.object({
        userId: v.id('users'),
        groupId: v.optional(v.id('groups')),
      }),
    ),
  }).index('by_label', ['label']),
})
