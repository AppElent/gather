import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  babyBarSlotValidator,
  babyEventDataValidator,
  babyEventTypeValidator,
} from './lib/babyEvents'
import { mealValidator, quantityUnitValidator } from './lib/consumption'
import {
  buyingCostLinesValidator,
  chargeValidator,
  costCategoryValidator,
  costFrequencyValidator,
  holdingKindValidator,
  loanPartKindValidator,
  netWorthRowValidator,
  repaymentValidator,
  splitPartyValidator,
  splitShareValidator,
  transactionKindValidator,
  transferTaxBandValidator,
} from './lib/finance'
import { nutritionSourceValidator, nutritionValidator } from './lib/nutrition'
import { servingValidator } from './lib/servings'
import {
  tastingAttributesValidator,
  tastingKindValidator,
} from './lib/tastings'

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
    groceryListId: v.optional(v.id('taskLists')),
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
    hiddenCalendarIds: v.optional(v.array(v.id('calendars'))),
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
    display: v.optional(
      v.object({
        due: v.boolean(),
        priority: v.boolean(),
        labels: v.boolean(),
      }),
    ),
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
    notes: v.optional(v.string()),
    createdBy: v.id('users'),
    order: v.number(),
  }).index('by_list', ['listId']),

  notes: defineTable({
    groupId: v.id('groups'),
    title: v.string(),
    body: v.string(),
    pinned: v.optional(v.boolean()),
    createdBy: v.id('users'),
    updatedAt: v.number(),
  }).index('by_group', ['groupId']),

  mealEntries: defineTable({
    groupId: v.id('groups'),
    title: v.string(),
    prepMinutes: v.optional(v.number()),
    createdBy: v.id('users'),
  }).index('by_group', ['groupId']),

  plannedDinners: defineTable({
    groupId: v.id('groups'),
    date: v.string(),
    recipeId: v.optional(v.id('recipes')),
    mealEntryId: v.optional(v.id('mealEntries')),
    title: v.string(),
    prepMinutes: v.optional(v.number()),
    quickLimit: v.optional(
      v.union(v.literal(10), v.literal(20), v.literal(30)),
    ),
  })
    .index('by_group', ['groupId'])
    .index('by_group_date', ['groupId', 'date']),

  pantryEntries: defineTable({
    groupId: v.id('groups'),
    title: v.string(),
    quantity: v.optional(v.string()),
    createdBy: v.id('users'),
  }).index('by_group', ['groupId']),

  calendars: defineTable({
    groupId: v.id('groups'),
    name: v.string(),
    source: v.literal('local'),
    createdBy: v.id('users'),
  }).index('by_group', ['groupId']),

  calendarEvents: defineTable({
    calendarId: v.id('calendars'),
    title: v.string(),
    date: v.string(),
    startMinutes: v.optional(v.number()),
    endMinutes: v.optional(v.number()),
    createdBy: v.id('users'),
  })
    .index('by_calendar', ['calendarId'])
    .index('by_calendar_date', ['calendarId', 'date']),

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
    // Which event types this child's log *refuses* — everything else is
    // offered by the quick-log buttons and the type picker (ADR-0022). Absent
    // or empty means nothing has been turned off.
    //
    // The refusals and not the acceptances, because a list of acceptances
    // cannot distinguish "they said no" from "this did not exist when they
    // were asked", and so silently withholds every type added after a
    // household made its choice. See `trackedEventTypes` in @gather/core.
    //
    // Never a filter on what is read. Turning a type off shrinks the offer and
    // leaves every logged event visible and editable, because a preference must
    // not be able to hide a record somebody is showing a doctor.
    untrackedTypes: v.optional(v.array(babyEventTypeValidator)),
    // The acceptances this replaced. Read only by `migrations.declineByOmission`
    // and written by nothing; it goes when docs/migrations/0007 records that
    // the migration has run on every deployment.
    trackedTypes: v.optional(v.array(babyEventTypeValidator)),
    // Where each of those buttons sits on the log bar, and whether the two
    // shortcuts that are not events — a to-do, a question — are on it at all.
    // Never a second copy of `untrackedTypes`: an entry here that is no longer
    // tracked is dropped on read and a tracked type missing from here is
    // appended, so the two cannot disagree. Absent means the arrangement
    // nobody has changed yet, which is why this needs no backfill either.
    barOrder: v.optional(v.array(babyBarSlotValidator)),
    // The to-do and questions cards are just local taskLists, reusing the Tasks
    // module instead of parallel concepts. `babies.create` resolves both — a
    // list the caller picked, or a new one named after the child — and
    // ensureTodoList / ensureQuestionsList still fill them in for children
    // created before it did.
    taskListId: v.optional(v.id('taskLists')),
    questionsListId: v.optional(v.id('taskLists')),
    // Whether the card points at a list that has a life of its own. A list the
    // child was given dies with the child; a list somebody *chose* survives it,
    // the same way a shared recipe is un-shared rather than deleted. Absent
    // means the child was given the list, which is true of every row created
    // before anyone could choose.
    taskListChosen: v.optional(v.boolean()),
    questionsListChosen: v.optional(v.boolean()),
    order: v.number(),
  }).index('by_group', ['groupId']),

  babyEvents: defineTable({
    babyId: v.id('babies'),
    type: babyEventTypeValidator,
    // One photo, on the event rather than inside `data`: a Memory is the type
    // that needs it today, but a rash on a Note and a red book page on a
    // Growth are the same field, and putting it in the per-type payload would
    // mean adding it three times. Registered in `lib/storedFiles.ts` so the
    // blob goes when the last row lets go of it.
    photoId: v.optional(v.id('_storage')),
    timestamp: v.number(), // epoch ms, when the event occurred
    endTimestamp: v.optional(v.number()), // sleep/feeding session duration
    notes: v.optional(v.string()),
    loggedBy: v.id('users'),
    data: babyEventDataValidator,
  })
    .index('by_baby', ['babyId'])
    .index('by_baby_type', ['babyId', 'type']),

  // -- Finances -----------------------------------------------------------
  //
  // Every figure below is one a Member typed (ADR-0025). Nothing here is read
  // from a bank, a property register or a broker, and money is always a whole
  // number of cents.
  //
  // Finance content is Group-scoped and never shared into a second Group, so
  // these tables carry `groupId` alone rather than the `sharedGroupIds` pair
  // Recipes needs (ADR-0003).

  // The container for what a home costs. Entered by hand, and it may be one
  // the Group is only considering rather than one they own.
  houses: defineTable({
    groupId: v.id('groups'),
    createdByUserId: v.id('users'),
    name: v.string(),
    // What the Group last said it is worth, and when they said it. Both
    // optional: adding a house asks for a name and nothing else.
    valueCents: v.optional(v.number()),
    valueAsOf: v.optional(v.string()), // YYYY-MM-DD
    boughtOn: v.optional(v.string()), // YYYY-MM-DD
    order: v.number(),
  }).index('by_group', ['groupId']),

  // One or more per House. A record the Group edits in place; asking "what if"
  // duplicates it rather than changing it (ADR-0025).
  mortgageCalculations: defineTable({
    groupId: v.id('groups'),
    houseId: v.id('houses'),
    createdByUserId: v.id('users'),
    updatedByUserId: v.id('users'),
    updatedAt: v.number(),
    name: v.string(),
    order: v.number(),
  })
    .index('by_group', ['groupId'])
    .index('by_house', ['houseId']),

  // A mortgage is not one loan. Each part is priced on its own and the
  // calculation's totals are their sum; extra repayments and the optional
  // early-repayment charge belong to the part whose interest they change.
  loanParts: defineTable({
    groupId: v.id('groups'),
    calculationId: v.id('mortgageCalculations'),
    kind: loanPartKindValidator,
    principalCents: v.number(),
    annualRatePercent: v.number(),
    termMonths: v.number(),
    // The date the fix ends, rather than a count of months: a stored count
    // would quietly mean something different every month it was not opened.
    fixedUntil: v.optional(v.string()), // YYYY-MM-DD
    // What the Member says the rate becomes then, and the other figures they
    // wanted to compare against. Gather forecasts nothing.
    expiryRatePercent: v.optional(v.number()),
    expiryRateOptions: v.optional(v.array(v.number())),
    repayments: v.optional(v.array(repaymentValidator)),
    charge: v.optional(chargeValidator),
    order: v.number(),
  })
    .index('by_group', ['groupId'])
    .index('by_calculation', ['calculationId']),

  // One per House. A purchase nobody has made yet is simply a House the Group
  // does not own.
  homeBuyingCosts: defineTable({
    groupId: v.id('groups'),
    houseId: v.id('houses'),
    updatedByUserId: v.id('users'),
    purchasePriceCents: v.number(),
    ownMoneyCents: v.number(),
    mortgageCents: v.number(),
    mortgageRatePercent: v.number(),
    mortgageTermMonths: v.number(),
    transferTaxBand: transferTaxBandValidator,
    // Stored beside the band because rates change by act of parliament: the
    // band is what the Member chose, the percent is what applied when they did.
    transferTaxPercent: v.number(),
    lines: v.optional(buyingCostLinesValidator),
    nhgPercent: v.optional(v.number()),
  })
    .index('by_group', ['groupId'])
    .index('by_house', ['houseId']),

  // What the household pays over and over. No due dates, no payment status and
  // no renewals: the totals are the product.
  recurringCosts: defineTable({
    groupId: v.id('groups'),
    createdByUserId: v.id('users'),
    name: v.string(),
    amountCents: v.number(),
    frequency: costFrequencyValidator,
    category: costCategoryValidator,
    note: v.optional(v.string()),
    // How the Group divides it. A ratio, never a debt - nothing accrues and
    // nothing settles. Absent or empty means the cost is not divided.
    split: v.optional(v.array(splitShareValidator)),
    order: v.number(),
  }).index('by_group', ['groupId']),

  savingsGoals: defineTable({
    groupId: v.id('groups'),
    createdByUserId: v.id('users'),
    name: v.string(),
    targetCents: v.number(),
    targetDate: v.string(), // YYYY-MM-DD
    // Entered by hand; there is no account to read it from.
    savedCents: v.number(),
    monthlyCents: v.optional(v.number()),
    updatedByUserId: v.id('users'),
    updatedAt: v.number(),
    order: v.number(),
  }).index('by_group', ['groupId']),

  // A Shared costs result somebody chose to keep. Immutable: changing one
  // duplicates it instead.
  splitScenarios: defineTable({
    groupId: v.id('groups'),
    createdByUserId: v.id('users'),
    createdAt: v.number(),
    name: v.string(),
    // Members are snapshotted by name as well as by id, so a saved split still
    // reads correctly after somebody leaves the Group.
    payments: v.array(
      v.object({
        party: splitPartyValidator,
        amountCents: v.number(),
        label: v.optional(v.string()),
      }),
    ),
    participants: v.array(splitPartyValidator),
    mode: v.union(v.literal('equal'), v.literal('custom')),
    // Frozen results rather than inputs to recompute: the Members and their
    // ids may be gone, and a scenario that recalculated would stop being the
    // thing that was saved.
    owed: v.array(
      v.object({ party: splitPartyValidator, amountCents: v.number() }),
    ),
    transfers: v.array(
      v.object({
        from: splitPartyValidator,
        to: splitPartyValidator,
        amountCents: v.number(),
      }),
    ),
    totalCents: v.number(),
  }).index('by_group', ['groupId']),

  // Listed stocks and ETFs only (ADR-0026).
  holdings: defineTable({
    groupId: v.id('groups'),
    createdByUserId: v.id('users'),
    kind: holdingKindValidator,
    // Enough to name one instrument rather than one ticker: the same symbol
    // trades in two currencies on two exchanges, and a Portfolio that cannot
    // tell them apart is one that adds dollars to euros.
    symbol: v.string(),
    name: v.string(),
    exchange: v.optional(v.string()),
    currency: v.string(),
    // The dated position everything else is built on.
    openingDate: v.string(), // YYYY-MM-DD
    openingUnits: v.number(),
    openingAverageCostCents: v.number(),
    // The last price anybody has, and the moment it is as at. There is no
    // price without one, and a refresh that fails leaves both alone so the
    // screen can say how old the figure is instead of blanking it.
    lastPriceCents: v.optional(v.number()),
    lastPriceAt: v.optional(v.number()),
    order: v.number(),
  }).index('by_group', ['groupId']),

  holdingTransactions: defineTable({
    groupId: v.id('groups'),
    holdingId: v.id('holdings'),
    createdByUserId: v.id('users'),
    kind: transactionKindValidator,
    date: v.string(), // YYYY-MM-DD
    units: v.optional(v.number()),
    pricePerUnitCents: v.optional(v.number()),
    perUnitCents: v.optional(v.number()),
    feeCents: v.optional(v.number()),
    note: v.optional(v.string()),
  })
    .index('by_group', ['groupId'])
    .index('by_holding', ['holdingId']),

  // The Group's home currency, and the conversions a Member entered for the
  // currencies their holdings trade in.
  financeSettings: defineTable({
    groupId: v.id('groups'),
    homeCurrency: v.string(),
    rates: v.optional(
      v.array(
        v.object({
          currency: v.string(),
          // Home-currency units per one unit of `currency`.
          rate: v.number(),
          asOf: v.number(),
        }),
      ),
    ),
  }).index('by_group', ['groupId']),

  // What the household owns and owes, apart from the rows Net worth derives.
  netWorthEntries: defineTable({
    groupId: v.id('groups'),
    createdByUserId: v.id('users'),
    kind: v.union(v.literal('asset'), v.literal('liability')),
    label: v.string(),
    amountCents: v.number(),
    order: v.number(),
  }).index('by_group', ['groupId']),

  // Only ever explicit, and never edited afterwards. A snapshot freezes the
  // derived rows too, including the moment the prices came from.
  netWorthSnapshots: defineTable({
    groupId: v.id('groups'),
    takenByUserId: v.id('users'),
    takenOn: v.string(), // YYYY-MM-DD
    takenAt: v.number(),
    rows: v.array(netWorthRowValidator),
    assetsCents: v.number(),
    liabilitiesCents: v.number(),
    netCents: v.number(),
  }).index('by_group', ['groupId']),
  /**
   * A thing a household has tasted — a cheese, a bottle, a beer (ADR-0024).
   *
   * **Group-scoped and one table for three Kinds.** `kind` is the
   * discriminator and `attributes` holds whatever that Kind's spec declares
   * (`@gather/core/tastings`), so a fourth Kind is a row in that table rather
   * than a fourth pair of tables here. The schema deliberately does not know
   * what a wine is; `checkedAttributes` enforces the spec on every write.
   *
   * **A subject comes into being because somebody logged against it**, never
   * as a separate first step — which is why there is no "add a cheese" screen
   * and why a subject with no Tastings only exists between two writes of one
   * transaction.
   *
   * No `sharedGroupIds`, unlike a recipe: a subject without its Tastings is a
   * name anybody could type, and with them it would carry other people's
   * Attribution across a boundary (#199, No Share, no Move).
   */
  tastingSubjects: defineTable({
    groupId: v.id('groups'),
    kind: tastingKindValidator,
    /** Content. Never translated — Comté is Comté (ADR-0011, story 30). */
    name: v.string(),
    /** The Kind spec's `subjectFields`. Facts, which do not change per tasting. */
    attributes: tastingAttributesValidator,
    /** The label, so you can recognise the bottle in a shop. Optional always. */
    photoId: v.optional(v.id('_storage')),
    /**
     * Provenance: which `tastingCatalog` entry this was materialised from.
     *
     * Nothing in a Group ever *points at* a catalog row — choosing one copies
     * it (ADR-0024). This is what makes materialising idempotent, so tasting
     * Gouda twice yields one Gouda, and it is why a hand-typed "Gouda" (which
     * carries no key) can sit beside the catalog's one without either being
     * a duplicate of the other.
     */
    catalogKey: v.optional(v.string()),
    /** Attribution only. Confers no ownership and no access (CONTEXT.md). */
    createdByUserId: v.id('users'),
  })
    .index('by_group_kind', ['groupId', 'kind'])
    // Materialising a catalog entry asks exactly this question, on every log.
    .index('by_group_kind_catalogKey', ['groupId', 'kind', 'catalogKey']),

  /**
   * One person's tasting of one subject, on one day.
   *
   * Tasting the same thing again **adds a row** rather than overwriting the
   * last one, and two Members of a wine club genuinely disagree — which is the
   * whole reason this is not a `rating` column on the subject.
   *
   * `groupId` is denormalized off the subject so the Group's activity stream
   * can read its Tastings in one indexed query instead of fanning out over
   * every subject. The two can never disagree: a Tasting is only ever created
   * against a subject already resolved in that Group, and nothing moves either.
   */
  tastings: defineTable({
    subjectId: v.id('tastingSubjects'),
    groupId: v.id('groups'),
    /** 1–5 in half steps, one scale for every Kind. See `TASTING_RATING`. */
    rating: v.number(),
    /**
     * The day it was tasted, `YYYY-MM-DD`, defaulting to today — deliberately
     * distinct from `_creationTime`, so logging Saturday's dinner on Monday
     * records Saturday (story 12). The activity stream orders by when it was
     * *logged*, which is the other one.
     */
    tastedAt: v.string(),
    /** The Kind spec's `tastingFields`. Impressions, and the notes. */
    attributes: tastingAttributesValidator,
    /**
     * Whose opinion this is. Unlike everywhere else in the schema, this one
     * *does* confer something: only the author may edit their own Tasting,
     * because editing somebody's score puts words in their mouth under their
     * name. Deleting is ordinary tidying and anyone in the Group may do it.
     */
    createdByUserId: v.id('users'),
  })
    .index('by_subject', ['subjectId'])
    .index('by_group', ['groupId']),

  /**
   * The shipped list of well-known things, as a **picker** (ADR-0024).
   *
   * This is the opposite of the foods Catalog and a reader who knows that one
   * will guess wrong, so: a `tastingCatalog` row is a *suggestion*. Choosing
   * one copies it into the Group as that Group's own subject and the catalog
   * row is then irrelevant to it forever — retiring an entry cannot orphan
   * anything, and a household editing "its" Comté is editing its own row.
   * The foods Catalog is the other kind: a *fact*, referenced and read-only.
   *
   * Reconciled by `seedKey` under ADR-0004 like every other seeded table, and
   * read-only through every public function. Cheese ships entries; wine and
   * beer deliberately ship none.
   */
  tastingCatalog: defineTable({
    seedKey: v.string(),
    kind: tastingKindValidator,
    name: v.string(),
    attributes: tastingAttributesValidator,
  })
    .index('by_kind', ['kind'])
    .index('by_seedKey', ['seedKey']),

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
