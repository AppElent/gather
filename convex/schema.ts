import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  babyBarSlotValidator,
  babyEventDataValidator,
  babyEventTypeValidator,
  babySexValidator,
} from './lib/babyEvents'
import {
  calendarColorValidator,
  calendarPeopleFilterValidator,
  calendarViewValidator,
} from './lib/calendar'
import {
  buyingCostLinesValidator,
  holdingFields,
  holdingTransactionFields,
  loanPartFields,
  netWorthKindValidator,
  netWorthRowValidator,
  recurringCostFields,
  splitScenarioFields,
  transferTaxBandValidator,
} from './lib/finance'
import {
  groceryAisleValidator,
  groceryCacheSourceValidator,
  groceryUnitValidator,
} from './lib/groceryFields'
import { groupRoleValidator } from './lib/groupAccess'
import { mealSlotValidator, quickLimitValidator } from './lib/kitchen'
import {
  barcodeFormatValidator,
  formatConfidenceValidator,
  retailerCategoryValidator,
} from './lib/loyaltyCards'
import {
  notificationPayloadValidator,
  notificationSwitchesValidator,
  pushLocaleValidator,
  pushPlatformValidator,
} from './lib/notificationFields'
import { nutritionValidator } from './lib/nutrition'
import { recipeFields } from './lib/recipeFields'
import {
  externalProviderValidator,
  providerConfigValidator,
  taskListColorValidator,
  taskListDisplayValidator,
  taskListIconValidator,
  taskListKindValidator,
  taskPriorityValidator,
  taskProviderValidator,
  taskReminderValidator,
  taskRepeatValidator,
} from './lib/taskFields'
import { taskSectionValidator } from './lib/taskSections'
import {
  tastingAttributesValidator,
  tastingKindValidator,
} from './lib/tastings'

export default defineSchema({
  /**
   * The verified Sign in with Apple users (`sub`) Clerk links to an AppElent
   * login, keyed by its Clerk subject (APP-388). Mirrored from Clerk's signed
   * `user.created`/`user.updated` webhook (`convex/http.ts`) so web Apple
   * revocation can bind a code to the caller without a Clerk admin key on
   * Convex. Only logins with an Apple link have a row; `user.deleted` drops
   * it, and deleting Gather's data only keeps it, because the login stays.
   * `clerkUpdatedAt` is the Clerk user's `updated_at`, so an older delivery
   * never overwrites a newer one.
   */
  appleSignInLinks: defineTable({
    clerkId: v.string(),
    appleUserIds: v.array(v.string()),
    clerkUpdatedAt: v.number(),
  }).index('by_clerkId', ['clerkId']),
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
    defaultGroupId: v.optional(v.id('groups')),
    // Set the moment somebody asks for their account to be deleted, and only
    // ever cleared by the row itself going. The purge runs across several
    // scheduled steps, so for a few seconds this row still exists while
    // nothing it owns does — and `ensureUser` runs on every app mount and
    // would otherwise hand the account straight back. This is what stops it.
    // Deleting Gather's data only, and the Clerk webhook, also release the
    // row's `clerkId` (`released:<id>`), so the tombstone never blocks the
    // login from starting again (ADR-0050).
    deletedAt: v.optional(v.number()),
    // Retired with the Nutrition Module (ADR-0041): read and written by
    // nothing. It stays declared only so a deployment whose users still carry
    // it accepts the schema; `maintenance:retireNutrition` unsets it, and
    // docs/migrations/0008 says when this line goes.
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
    // Which push notifications this person wants, in every Group (APP-298).
    // Absent, or a switch absent inside it, means on; a Group is muted on its
    // membership row below.
    notificationSwitches: v.optional(notificationSwitchesValidator),
  }).index('by_clerkId', ['clerkId']),

  groups: defineTable({
    name: v.string(),
    inviteCode: v.string(),
    // Globally unique: Group-scoped functions take the Current Group as
    // `groupSlug` and resolve it by this.
    slug: v.string(),
    // Legacy only. New writes omit this; `removePersonalGroupSemantics`
    // removes it from existing rows before the next schema tightening.
    isPersonal: v.optional(v.boolean()),
    icon: v.optional(v.string()),
    imageId: v.optional(v.id('_storage')),
    groceryListId: v.optional(v.id('taskLists')),
  })
    .index('by_inviteCode', ['inviteCode'])
    .index('by_slug', ['slug']),

  memberships: defineTable({
    groupId: v.id('groups'),
    userId: v.id('users'),
    role: groupRoleValidator,
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
    calendarView: v.optional(calendarViewValidator),
    calendarPeopleFilter: v.optional(calendarPeopleFilterValidator),
    // This person sends themselves no push notifications from this Group
    // (APP-298). One person's choice, like Pins, and it goes with the row.
    notificationsMuted: v.optional(v.boolean()),
  })
    .index('by_user', ['userId'])
    .index('by_group', ['groupId']),

  recipes: defineTable({
    // A recipe belongs to a Group, not to whoever typed it in. `groupId` is the
    // home Group; `sharedGroupIds` are the further Groups it is visible in and
    // never contains `groupId`. `createdByUserId` is attribution — it records
    // who added the recipe and confers no ownership and no access (GLOSSARY.md).
    // All three are required: an optional ownership field is a schema that has
    // stopped saying who owns the row.
    groupId: v.id('groups'),
    sharedGroupIds: v.array(v.id('groups')),
    createdByUserId: v.id('users'),
    ...recipeFields,
    nutritionStale: v.optional(v.boolean()),
  }).index('by_group', ['groupId']),

  // One row per Group a recipe is Shared into: an index of
  // `recipes.sharedGroupIds`, which stays the source of truth. A Convex index
  // cannot key on membership of an array, so this is how "the recipes shared
  // into this Group" is read without scanning every recipe. Written only by
  // `lib/recipeShares.ts`; `groupId` is the Group shared *into*, not the
  // recipe's home.
  recipeShares: defineTable({
    recipeId: v.id('recipes'),
    groupId: v.id('groups'),
  })
    .index('by_group', ['groupId'])
    .index('by_recipe_group', ['recipeId', 'groupId']),

  taskLists: defineTable({
    groupId: v.id('groups'),
    name: v.string(),
    provider: taskProviderValidator,
    providerConfig: v.optional(providerConfigValidator),
    order: v.number(),
    display: v.optional(taskListDisplayValidator),
    // APP-306. Optional, and absent on every list made before them: an absent
    // kind is a plain list, and an absent icon or colour is the kind's own
    // (`taskListFace` in `@gather/core/task-lists`).
    kind: v.optional(taskListKindValidator),
    icon: v.optional(taskListIconValidator),
    color: v.optional(taskListColorValidator),
    /**
     * When a Member last chose "Clear checked" on a grocery list (APP-310):
     * items checked before it leave the list's Checked section but stay in
     * Recent. Absent until the first clear.
     */
    checkedClearedAt: v.optional(v.number()),
    /**
     * A Member switched the "Maybe needed" suggestions off for this grocery
     * list (APP-311). Absent is on.
     */
    suggestionsOff: v.optional(v.boolean()),
    /**
     * Names a Member hid from this list's suggestions for good (APP-311), as
     * `groceryTitleKey`s, at most `HIDDEN_SUGGESTIONS_LIMIT`. Absent is none.
     */
    hiddenSuggestions: v.optional(v.array(v.string())),
    // APP-357. The list's sections in the order they are drawn; absent on
    // every list made before them, which reads as no sections.
    sections: v.optional(v.array(taskSectionValidator)),
  }).index('by_group', ['groupId']),

  // Rows exist only for provider === 'local' lists.
  tasks: defineTable({
    listId: v.id('taskLists'),
    title: v.string(),
    done: v.boolean(),
    dueDate: v.optional(v.string()), // ISO date, YYYY-MM-DD
    priority: v.optional(taskPriorityValidator),
    labels: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    // A wishlist item's link (http or https only) and price in cents (APP-306).
    url: v.optional(v.string()),
    priceCents: v.optional(v.number()),
    createdBy: v.id('users'),
    order: v.number(),
    /**
     * The aisle of an item on a Group's grocery list (APP-353), set by the
     * server when the item is added and by a Member's correction. Absent on
     * other lists and on items added before recognition existed.
     */
    category: v.optional(groceryAisleValidator),
    /**
     * A grocery item's amount and unit (APP-309): "2 pakken melk" is the
     * title "melk" with 2 `pak`. Only on grocery lists, and absent on items
     * added without an amount and on every item from before amounts: those
     * read as one, with no unit shown.
     */
    quantity: v.optional(v.number()),
    unit: v.optional(groceryUnitValidator),
    /**
     * When the task was last checked (APP-310); cleared when it is unchecked.
     * Absent on open tasks and on tasks checked before it existed. A grocery
     * list's Recent is its checked items, newest first, read through
     * `by_list_and_done_at`.
     */
    doneAt: v.optional(v.number()),
    /**
     * The one Member responsible for the task (APP-302): a current Member of
     * the list's Group, checked on every write. Leaving the Group clears it
     * (`detachFromGroup`). Absent is nobody, and on every task from before.
     */
    assigneeId: v.optional(v.id('users')),
    /**
     * Present while the assignee has not yet opened a task someone else gave
     * them: who gave it and when. It is the in-app notice beside the push
     * (APP-302); opening the task, a new assignee, or none clears it.
     */
    assignmentNotice: v.optional(
      v.object({ by: v.id('users'), at: v.number() }),
    ),
    /**
     * How the task comes back once completed (APP-303). Absent on a task that
     * does not repeat, which is every task from before repeats. A repeating
     * task stays open: completing it moves `dueDate` on and writes a
     * `taskCompletions` row.
     */
    repeat: v.optional(taskRepeatValidator),
    /**
     * A reminder somebody chose (APP-305); a due date alone sets none. Absent
     * on every task without one. Its send is a `scheduledNotifications` row
     * under `taskReminderKey`, kept in step by `lib/taskReminders.ts`.
     */
    reminder: v.optional(taskReminderValidator),
    /**
     * The section of its list the task sits in (APP-357): an id from
     * `taskLists.sections`. Absent, or naming a section the list no longer
     * has, it sits under "No section". Installed apps from before sections
     * never read it and draw the task as before.
     */
    sectionId: v.optional(v.string()),
  })
    .index('by_list', ['listId'])
    // The end of a list without reading all of it (APP-368).
    .index('by_list_and_order', ['listId', 'order'])
    // A list's open items without reading what was checked off (APP-314).
    .index('by_list_and_done', ['listId', 'done'])
    // A list's newest checked items without reading the rest (APP-310).
    .index('by_list_and_done_at', ['listId', 'doneAt'])
    // A person's tasks across lists: the leave-Group clean-up, the in-app
    // notice, and later the "Mine" smart list (APP-301).
    .index('by_assignee', ['assigneeId']),

  /**
   * One completion of a repeating task (APP-303): who, when, and the due
   * date it moved from and to, so the completion can be undone right after.
   * Carries the task's Group so the Group's deletion and export reach it
   * without walking its lists; deleted with its task.
   */
  taskCompletions: defineTable({
    groupId: v.id('groups'),
    taskId: v.id('tasks'),
    completedBy: v.id('users'),
    completedAt: v.number(),
    /** The completer's calendar day, `YYYY-MM-DD`. */
    completedOn: v.string(),
    previousDueDate: v.optional(v.string()),
    nextDueDate: v.string(),
  })
    .index('by_task', ['taskId'])
    .index('by_group', ['groupId']),

  /**
   * A Group's own aisle for a grocery name: written when a Member moves an
   * item to another aisle, and it wins over everything else for that Group
   * (APP-353). `name` is the `groceryKey` of the item's name.
   */
  groceryCategoryOverrides: defineTable({
    groupId: v.id('groups'),
    name: v.string(),
    aisle: groceryAisleValidator,
    updatedBy: v.id('users'),
    updatedAt: v.number(),
  })
    .index('by_group_and_name', ['groupId', 'name'])
    .index('by_name_and_aisle', ['name', 'aisle']),

  /**
   * The shared answer for a grocery name the bundled dictionary does not
   * know: asked of a small model once, or agreed by at least three Groups'
   * corrections (APP-353). Holds no Group or person data: the key is the
   * normalised name only. `aisle` is absent while the question is out. Rows
   * nothing backs any more are pruned daily (ADR-0049).
   */
  groceryCategoryCache: defineTable({
    name: v.string(),
    aisle: v.optional(groceryAisleValidator),
    source: groceryCacheSourceValidator,
    askedAt: v.number(),
    answeredAt: v.optional(v.number()),
    /**
     * Items added while the question was out, moved when the answer comes
     * in, however late (APP-368). Cleared with the answer.
     */
    waitingTaskIds: v.optional(v.array(v.id('tasks'))),
  }).index('by_name', ['name']),

  /**
   * How many grocery-aisle questions went to the model on a UTC day: the
   * global budget behind the AI fallback, separate from any person's own
   * cap (`lib/aiUsage.ts`), because nobody asked for these calls.
   */
  groceryAiUsage: defineTable({
    /** `YYYY-MM-DD`, UTC. */
    day: v.string(),
    count: v.number(),
  }).index('by_day', ['day']),

  /**
   * The same questions counted per Group (APP-368), so one Group cannot spend
   * the whole day's global budget. Goes with the Group.
   */
  groceryAiGroupUsage: defineTable({
    groupId: v.id('groups'),
    /** `YYYY-MM-DD`, UTC. */
    day: v.string(),
    count: v.number(),
  }).index('by_group_and_day', ['groupId', 'day']),

  notes: defineTable({
    groupId: v.id('groups'),
    title: v.string(),
    body: v.string(),
    pinned: v.optional(v.boolean()),
    createdBy: v.id('users'),
    // Who last changed it. Absent on notes nobody has edited since this was
    // added; the creator is the last editor of those.
    updatedBy: v.optional(v.id('users')),
    updatedAt: v.number(),
  }).index('by_group', ['groupId']),

  mealEntries: defineTable({
    groupId: v.id('groups'),
    title: v.string(),
    prepMinutes: v.optional(v.number()),
    createdBy: v.id('users'),
  }).index('by_group', ['groupId']),

  // Planned meals (ADR-0027). The table keeps its first name: renaming it
  // would be a copy migration with nothing to gain. At most one row per
  // Group, date and slot; `slot` absent is a dinner planned before slots
  // existed (`maintenance:backfillMealSlots` fills it in).
  plannedDinners: defineTable({
    groupId: v.id('groups'),
    date: v.string(),
    slot: v.optional(mealSlotValidator),
    recipeId: v.optional(v.id('recipes')),
    mealEntryId: v.optional(v.id('mealEntries')),
    title: v.string(),
    prepMinutes: v.optional(v.number()),
    // Absent: as many as eat along.
    servings: v.optional(v.number()),
    note: v.optional(v.string()),
    // Absent: the Group's default eaters for that evening.
    eaterIds: v.optional(v.array(v.id('users'))),
    // Written only by phones from before slots; read as a legacy field.
    quickLimit: v.optional(quickLimitValidator),
  })
    .index('by_group', ['groupId'])
    .index('by_group_date', ['groupId', 'date']),

  // The Pantry before it folded into Groceries as In stock (APP-314). Kept,
  // unread by current phones, while installed apps still call `kitchen.*`
  // pantry functions; `maintenance:migratePantryToStaples` copies it into
  // `groceryStaples`. Dropped in the contract step after the next OTA.
  pantryEntries: defineTable({
    groupId: v.id('groups'),
    title: v.string(),
    quantity: v.optional(v.string()),
    createdBy: v.id('users'),
  }).index('by_group', ['groupId']),

  /**
   * What a household always wants in the house (APP-314, Groceries "In
   * stock"): each staple is in stock or running low. Running low puts it on
   * the Group's grocery list; checking it off there puts it back in stock.
   * `key` is the `groceryTitleKey` of `name`, so "Melk" and "2 pak melk" are
   * one staple; at most one row per Group and key.
   */
  groceryStaples: defineTable({
    groupId: v.id('groups'),
    name: v.string(),
    key: v.string(),
    aisle: groceryAisleValidator,
    low: v.boolean(),
    /** A pantry entry's free quantity ("2 pakken"), kept from the migration. */
    note: v.optional(v.string()),
    createdBy: v.id('users'),
  })
    .index('by_group', ['groupId'])
    .index('by_group_and_key', ['groupId', 'key']),

  calendars: defineTable({
    groupId: v.id('groups'),
    name: v.string(),
    source: v.literal('local'),
    createdBy: v.id('users'),
    color: v.optional(calendarColorValidator),
  }).index('by_group', ['groupId']),

  calendarEvents: defineTable({
    calendarId: v.id('calendars'),
    title: v.string(),
    date: v.string(),
    startMinutes: v.optional(v.number()),
    endMinutes: v.optional(v.number()),
    createdBy: v.id('users'),
    allDay: v.optional(v.boolean()),
    assigneeIds: v.optional(v.array(v.id('users'))),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    revision: v.optional(v.number()),
  })
    .index('by_calendar', ['calendarId'])
    .index('by_calendar_date', ['calendarId', 'date']),

  integrationConnections: defineTable({
    groupId: v.id('groups'),
    provider: externalProviderValidator,
    accessToken: v.string(), // server-only; never returned by a public function
    accountLabel: v.string(), // Notion workspace name / 'Todoist'
    connectedBy: v.id('users'),
  }).index('by_group_provider', ['groupId', 'provider']),

  /**
   * How many AI calls a person has made on a UTC day — the one counter behind
   * every action that reaches Anthropic (`lib/aiUsage.ts`).
   *
   * **Personal** in the sense of ADR-0003: the cap is on the person, whichever
   * Group they were in when they asked, so there is a `userId` here and no
   * `groupId`. Account deletion removes these rows (`cascade.finishAccount`).
   *
   * Old days are never read again; nothing sweeps them because a row per
   * person per day they used AI is too small to be worth a job.
   */
  aiUsage: defineTable({
    userId: v.id('users'),
    /** `YYYY-MM-DD`, UTC. */
    day: v.string(),
    count: v.number(),
  }).index('by_user_and_day', ['userId', 'day']),

  /**
   * The answer to a create a connected app already made: an idempotency key
   * and the row it created (`lib/idempotency.ts`, ADR-0046). An agent retries a
   * write it lost the answer to; replaying the key returns the same row instead
   * of a second one.
   *
   * **Personal**: keys belong to the caller, whichever Group the row went to,
   * so there is a `userId` and no `groupId`. Account deletion removes these rows
   * (`cascade.finishAccount`); the export leaves them out as bookkeeping.
   */
  idempotencyKeys: defineTable({
    userId: v.id('users'),
    key: v.string(),
    /** The table the create wrote to; a key reused for another table is refused. */
    table: v.string(),
    docId: v.string(),
  }).index('by_user_and_key', ['userId', 'key']),

  /**
   * A phone that may receive this person's push notifications: its Expo push
   * token (APP-298, `notifications.ts`).
   *
   * **Personal**: a `userId` and no `groupId`. A token is one app install, so
   * it belongs to one row; registering it again under another account moves
   * it. It goes on sign-out (the phone releases it), when its session ends, on account
   * deletion (`cascade.finishAccount`), and when Expo reports the install
   * gone (`DeviceNotRegistered`). The export leaves it out as bookkeeping.
   *
   * `locale` is the phone's Language, which is a setting on the phone and not
   * on the account, so each phone is told in its own language. `sessionId` is
   * the Clerk session the phone registered under: a sign-out releases the row
   * by it, and a row whose session has ended is forgotten.
   */
  pushDevices: defineTable({
    userId: v.id('users'),
    token: v.string(),
    platform: pushPlatformValidator,
    locale: pushLocaleValidator,
    sessionId: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_token', ['token']),

  /**
   * A push notification waiting for its time, keyed by the caller's
   * `dedupeKey` (APP-298, `lib/notifications.ts`). One row per (person, key):
   * scheduling the key again replaces the job, and `generation` makes a job
   * that was already running when it was replaced send nothing, so one record
   * never sends twice.
   *
   * **Personal**: a `userId` and no top-level `groupId`; the Group is inside
   * the payload and checked when it sends. Account deletion removes these rows
   * (`cascade.finishAccount`); the export leaves them out as bookkeeping.
   */
  scheduledNotifications: defineTable({
    userId: v.id('users'),
    dedupeKey: v.string(),
    at: v.number(),
    payload: notificationPayloadValidator,
    // Absent only inside the transaction that inserts the row.
    jobId: v.optional(v.id('_scheduled_functions')),
    generation: v.number(),
  })
    .index('by_user_and_key', ['userId', 'dedupeKey'])
    // A deleted Group's queued sends, found without reading everybody's.
    .index('by_group', ['payload.groupId']),

  babies: defineTable({
    groupId: v.id('groups'),
    name: v.string(),
    birthDate: v.string(), // ISO YYYY-MM-DD
    sex: v.optional(babySexValidator),
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
    // ensureAuxLists still fills them in for children created before it did.
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
    ...loanPartFields,
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
    ...recurringCostFields,
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
    ...splitScenarioFields,
  }).index('by_group', ['groupId']),

  // Listed stocks and ETFs only (ADR-0026).
  holdings: defineTable({
    groupId: v.id('groups'),
    createdByUserId: v.id('users'),
    ...holdingFields,
    lastPriceAt: v.optional(v.number()),
    order: v.number(),
  }).index('by_group', ['groupId']),

  holdingTransactions: defineTable({
    groupId: v.id('groups'),
    holdingId: v.id('holdings'),
    createdByUserId: v.id('users'),
    ...holdingTransactionFields,
  })
    .index('by_group', ['groupId'])
    .index('by_holding', ['holdingId']),

  // Retired: a Group counts in euros only, and `holdings.settings` no longer
  // reads this. Nothing writes it. Kept only because existing rows would block
  // a deploy that dropped it: run `maintenance:deleteFinanceSettings` with
  // `{"apply":true}` in every deployment, then delete this table, its
  // `GROUP_CONTENT` entry and that mutation (docs/migrations/README.md).
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
    kind: netWorthKindValidator,
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
    /** Attribution only. Confers no ownership and no access (GLOSSARY.md). */
    createdByUserId: v.id('users'),
  })
    .index('by_group', ['groupId'])
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
   * A `tastingCatalog` row is a *suggestion*, not a referenced fact. Choosing
   * one copies it into the Group as that Group's own subject and the catalog
   * row is then irrelevant to it forever — retiring an entry cannot orphan
   * anything, and a household editing "its" Comté is editing its own row.
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

  /**
   * A store or loyalty card the Group keeps (APP-141). Group-scoped and shared
   * by every Member (APP-140 decision 1); `holder` says whose card it is, as
   * free text, because a card belongs to a person who may not be a Member.
   *
   * A card picked from the Retailer catalog is a copy, not a reference
   * (ADR-0043, after ADR-0024): name, brand colour, domain and barcode format
   * are written onto the card and `catalogKey` stays only as Provenance —
   * safe to dangle, never read back. Unlike a tasting subject, two cards may
   * share a `catalogKey`: two people in one household can both have a
   * Bonuskaart.
   */
  loyaltyCards: defineTable({
    groupId: v.id('groups'),
    /** Content, as the store writes itself. Never translated. */
    storeName: v.string(),
    catalogKey: v.optional(v.string()),
    /**
     * `#rrggbb`: copied from the Catalog, or the colour the form chose (its
     * default included) for a store typed by hand.
     */
    brandColor: v.optional(v.string()),
    /** The store's primary domain, for a logo later. */
    domain: v.optional(v.string()),
    /** What the till scans, already normalized for `barcodeFormat`. */
    cardNumber: v.string(),
    barcodeFormat: barcodeFormatValidator,
    holder: v.optional(v.string()),
    note: v.optional(v.string()),
    frontPhotoId: v.optional(v.id('_storage')),
    backPhotoId: v.optional(v.id('_storage')),
    /** Set by `markUsed` when the card is shown; absent until then. */
    lastUsedAt: v.optional(v.number()),
    /** Attribution only. Confers no ownership and no access (GLOSSARY.md). */
    createdByUserId: v.id('users'),
  }).index('by_group', ['groupId']),

  /**
   * The Retailer catalog: Dutch stores a card can be picked from (APP-141).
   *
   * Seeded reference data, reconciled by `seedKey` like the tasting Catalog
   * (ADR-0004), and a picker, never a reference (ADR-0043). Fixtures live in
   * `lib/seed/retailerCatalog.ts`.
   */
  retailerCatalog: defineTable({
    seedKey: v.string(),
    name: v.string(),
    aliases: v.array(v.string()),
    category: retailerCategoryValidator,
    brandColor: v.string(),
    domain: v.string(),
    barcodeFormat: barcodeFormatValidator,
    formatConfidence: formatConfidenceValidator,
    numberLength: v.optional(v.number()),
    numberPrefix: v.optional(v.string()),
  }).index('by_seedKey', ['seedKey']),

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
