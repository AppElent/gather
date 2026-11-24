/**
 * Plan mijn week (APP-319, designs/meal-planner section 3, direction A): a
 * proposal for the empty slots of one week, stored per Group and week as
 * drafts every Member sees in the week, until it is accepted, discarded or
 * 24 hours old.
 *
 * One plan is one AI call against the person's daily cap (`aiUsage`), taken
 * before the model is asked. Over the cap nothing is planned. When the model
 * gives no answer, the call is given back and the rules planner
 * (`@gather/core/week-plan`) makes a simpler plan, marked `fallback`. The
 * model may only pick recipe ids it was given or name a quick meal; the
 * server keeps nothing else, and fills what is left by the rules.
 *
 * Drafts live in their own table and `mealPlan.week` never returns them, so
 * a phone from before this feature shows the week exactly as before.
 * Accepting a draft writes an ordinary Planned meal into a slot that is still
 * empty; a filled slot is never overwritten. The calls are the phone's own:
 * connected apps are refused (ADR-0046).
 */
import { addDays, isIsoDate, localIsoDate, mondayStart } from '@gather/core/civil-date'
import {
  awayFromEvents,
  defaultEaters,
  eveningEvents,
  type MealSlot,
  weekdayIndex,
} from '@gather/core/meal-planner'
import { enabledSlots } from '@gather/core/meal-preferences'
import {
  AI_RECIPES_MAX,
  completePlan,
  DRAFT_LIFETIME_MS,
  draftCheck,
  plannableQuickMeals,
  plannableRecipes,
  rulesPlan,
  type WeekPlanInput,
  type WeekPlanPick,
  type WeekPlanTarget,
  type WeekPlanWish,
  WISH_MAX,
} from '@gather/core/week-plan'
import { ConvexError, type Infer, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import {
  type ActionCtx,
  action,
  internalMutation,
  internalQuery,
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from './_generated/server'
import { DAILY_AI_CALLS, takeRefundableAiCall } from './lib/aiUsage'
import { anthropicApiKey } from './lib/anthropic'
import { rejectConnectedApps } from './lib/connectedApps'
import {
  isVisibleToGroups,
  requireGroupBySlug,
  requireInGroup,
} from './lib/groupAccess'
import { mealSlotValidator, weekPlanWishValidator } from './lib/kitchen'
import { mealAt, mealPreferencesOf } from './lib/mealPlan'
import { recipesVisibleIn } from './lib/recipeShares'
import { requireIdentity } from './lib/sharing'
import { askWeekPlan, type WeekPlanPromptInput } from './lib/weekPlanAi'
import { weekOf } from './mealPlan'

const NOT_FOUND = 'Proposal not found'
/** How far back "last cooked" looks. */
const HISTORY_DAYS = 180
/** Stock names the model and the rules see at most. */
const STOCK_MAX = 60
/** A week holds at most 21 drafts (7 days, 3 slots). */
const SKIP_MAX = 21
/** Expired drafts one sweep deletes; the cron runs again within the hour. */
const SWEEP_BATCH = 500

const LEFTOVERS: Record<'nl' | 'en', string> = { nl: 'Restjes', en: 'Leftovers' }

const localeValidator = v.union(v.literal('nl'), v.literal('en'))
const sourceValidator = v.union(
  v.literal('ai'),
  v.literal('rules'),
  v.literal('fallback'),
)

/** A typed wish as the model sees it and a draft keeps it. */
export function cleanWish(wish: string | undefined) {
  return wish?.replace(/\s+/g, ' ').trim().slice(0, WISH_MAX) || undefined
}

/** The start sheet's wishes cleaned; `undefined` when nothing was asked. */
function cleanWishes(asked: { wishes?: WeekPlanWish[]; wish?: string }) {
  const wishes = [...new Set(asked.wishes ?? [])]
  const wish = cleanWish(asked.wish)
  return wishes.length > 0 || wish ? { wishes, wish } : undefined
}

function requireWeekStart(weekStart: string) {
  if (!isIsoDate(weekStart) || mondayStart(weekStart) !== weekStart)
    throw new ConvexError('Use the Monday of the week')
}

async function draftsOfWeek(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  weekStart: string,
) {
  return await ctx.db
    .query('mealPlanDrafts')
    .withIndex('by_group_week', (q) =>
      q.eq('groupId', groupId).eq('weekStart', weekStart),
    )
    .collect()
}

/**
 * The week's drafts as `list` shows them: not expired, the slot still empty,
 * and a recipe the Group can still see, with that recipe. `acceptAll` takes
 * the same set, so "Neem alle {n} over" counts what it plans (APP-460).
 */
async function shownDrafts(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  weekStart: string,
) {
  const now = Date.now()
  const [drafts, meals] = await Promise.all([
    draftsOfWeek(ctx, groupId, weekStart),
    ctx.db
      .query('plannedDinners')
      .withIndex('by_group_date', (q) =>
        q
          .eq('groupId', groupId)
          .gte('date', weekStart)
          .lte('date', addDays(weekStart, 6)),
      )
      .collect(),
  ])
  const filled = new Set(
    meals.map((meal) => `${meal.date}|${meal.slot ?? 'dinner'}`),
  )
  const shown = await Promise.all(
    drafts
      .filter(
        (draft) =>
          draft.expiresAt > now && !filled.has(`${draft.date}|${draft.slot}`),
      )
      .map(async (draft) => {
        const recipe = draft.recipeId ? await ctx.db.get(draft.recipeId) : null
        if (draft.recipeId && (!recipe || !isVisibleToGroups(recipe, [groupId])))
          return null
        return { draft, recipe }
      }),
  )
  return { drafts, shown: shown.filter((entry) => entry !== null) }
}

/** The rules planner's leftover evening is yesterday's dinner: nothing to check. */
function isLeftovers(draft: Doc<'mealPlanDrafts'>) {
  return (
    !draft.recipeId &&
    !draft.mealEntryId &&
    Object.values(LEFTOVERS).includes(draft.quickMeal ?? '')
  )
}

/**
 * The open proposal for a week: every draft that has not expired and whose
 * slot is still empty, with its recipe's live title and photo. A draft whose
 * recipe the Group can no longer see is left out. `check` is the allergy or
 * diet the matcher can't rule out ("controleer zelf", APP-460); for a quick
 * meal only a name the AI made up (APP-477). A phone from before it ignores
 * the field.
 */
export const list = query({
  args: { groupSlug: v.string(), weekStart: v.string() },
  handler: async (ctx, args) => {
    requireWeekStart(args.weekStart)
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const [{ shown: entries }, prefs] = await Promise.all([
      shownDrafts(ctx, group._id, args.weekStart),
      mealPreferencesOf(ctx, group._id, []),
    ])
    const shown = await Promise.all(
      entries.map(async ({ draft, recipe }) => {
          const check = recipe
            ? draftCheck({ recipe }, prefs)
            : isLeftovers(draft)
              ? undefined
              : draftCheck(
                  { quickMeal: draft.quickMeal ?? '', own: draft.mealEntryId !== undefined },
                  prefs,
                )
          return {
            _id: draft._id,
            date: draft.date,
            slot: draft.slot,
            title: recipe ? recipe.title : (draft.quickMeal ?? ''),
            recipeId: recipe ? recipe._id : undefined,
            prepMinutes: recipe ? recipe.prepMinutes : draft.prepMinutes,
            imageUrl: recipe?.imageId ? await ctx.storage.getUrl(recipe.imageId) : null,
            reason: draft.reason,
            source: draft.source,
            // What the start sheet asked for (APP-679); it opens on them again (APP-778).
            wishes: draft.wishes,
            wish: draft.wish,
            expiresAt: draft.expiresAt,
            check,
          }
        }),
    )
    return shown
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          ['breakfast', 'lunch', 'dinner'].indexOf(a.slot) -
            ['breakfast', 'lunch', 'dinner'].indexOf(b.slot),
      )
  },
})

/**
 * What the planners need, read once for one plan. `swapping` (Iets anders,
 * Nieuw idee, APP-320) keeps the asked slots as targets even when a meal is
 * there or the slot is switched off: the meal there is what gets replaced.
 */
export async function planContext(
  ctx: QueryCtx,
  args: {
    groupSlug: string
    weekStart: string
    dates: string[]
    slots: MealSlot[]
    locale: 'nl' | 'en'
    wishes: WeekPlanInput['wishes']
    wish?: string
    /** Regenerate: keep these recipes and quick meals out. */
    avoidRecipeIds?: string[]
    avoidMealEntryId?: string
    avoidQuickMeals?: string[]
    swapping?: boolean
  },
) {
  const { group } = await requireGroupBySlug(ctx, args.groupSlug)
  const today = localIsoDate()
  const from = args.weekStart
  const to = addDays(from, 6)
  const week = await weekOf(ctx, group._id, from, to)
  const prefs = week.preferences
  const filled = new Set(week.meals.map((meal) => `${meal.date}|${meal.slot}`))
  const wanted = new Set(args.dates)

  const targets: WeekPlanTarget[] = []
  for (let index = 0; index < 7; index++) {
    const date = addDays(from, index)
    if (!wanted.has(date)) continue
    const weekday = weekdayIndex(date)
    const slots = args.swapping ? args.slots : enabledSlots(prefs, weekday)
    for (const slot of slots) {
      if (!args.slots.includes(slot)) continue
      if (!args.swapping && filled.has(`${date}|${slot}`)) continue
      const evening =
        slot === 'dinner' && prefs.smart.useCalendar
          ? eveningEvents(week.events, date)[0]
          : undefined
      const away =
        slot === 'dinner' && prefs.smart.useCalendar
          ? awayFromEvents(week.events, date)
          : new Map<string, unknown>()
      targets.push({
        date,
        slot,
        maxMinutes: prefs.cookingMinutes[weekday] ?? null,
        busyAt: evening?.startMinutes,
        eaters: Math.max(1, defaultEaters(prefs.memberDefaults, away).length),
      })
    }
  }

  const [recipes, history, quickMeals, staples] = await Promise.all([
    recipesVisibleIn(ctx, group._id),
    ctx.db
      .query('plannedDinners')
      .withIndex('by_group_date', (q) =>
        q
          .eq('groupId', group._id)
          .gte('date', addDays(from, -HISTORY_DAYS))
          .lt('date', from),
      )
      .collect(),
    ctx.db
      .query('mealEntries')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect(),
    ctx.db
      .query('groceryStaples')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect(),
  ])
  const lastCooked = new Map<string, string>()
  for (const meal of history) {
    if (!meal.recipeId) continue
    const seen = lastCooked.get(meal.recipeId)
    if (!seen || seen < meal.date) lastCooked.set(meal.recipeId, meal.date)
  }
  const avoid = new Set(args.avoidRecipeIds ?? [])
  const plannable = plannableRecipes(
    recipes.map((recipe) => ({
      id: recipe._id as string,
      title: recipe.title,
      prepMinutes: recipe.prepMinutes,
      tags: recipe.tags,
      ingredients: recipe.ingredients,
      rating: recipe.rating,
      lastCooked: lastCooked.get(recipe._id),
    })),
    prefs,
  )
    // Best first, so the model's capped list keeps the likeliest recipes.
    .sort(
      (a, b) =>
        (b.rating ?? 0) - (a.rating ?? 0) ||
        (a.lastCooked ?? '').localeCompare(b.lastCooked ?? '') ||
        a.title.localeCompare(b.title),
    )
    .slice(0, AI_RECIPES_MAX * 2)

  const input: WeekPlanPromptInput = {
    targets,
    recipes: plannable,
    // A quick meal already in the week is not proposed again, nor one whose
    // name certainly clashes with the Group's allergens, diets or dislikes.
    quickMeals: plannableQuickMeals(
      quickMeals
        .filter(
          (entry) =>
            entry._id !== args.avoidMealEntryId &&
            !week.meals.some((meal) => meal.mealEntryId === entry._id),
        )
        .map((entry) => ({
          id: entry._id as string,
          title: entry.title,
          prepMinutes: entry.prepMinutes,
        })),
      prefs,
    ),
    skipQuickMeals: [
      ...week.meals.map((meal) => meal.title),
      ...(args.avoidQuickMeals ?? []).slice(0, SKIP_MAX),
    ],
    plannedRecipeIds: [
      ...week.meals.flatMap((meal) => (meal.recipeId ? [meal.recipeId as string] : [])),
      ...avoid,
    ],
    plannedDinnerDates: week.meals
      .filter((meal) => meal.slot === 'dinner')
      .map((meal) => meal.date),
    stock: {
      inStock: staples.filter((s) => !s.low).map((s) => s.name).slice(0, STOCK_MAX),
      low: staples.filter((s) => s.low).map((s) => s.name).slice(0, STOCK_MAX),
    },
    prefs,
    wishes: args.wishes,
    leftoversName: LEFTOVERS[args.locale],
    locale: args.locale,
    wish: cleanWish(args.wish),
    diets: prefs.diets,
    allergens: prefs.allergens,
    dislikes: prefs.dislikes,
    plannedTitles: week.meals.map((meal) => meal.title),
    today,
  }
  return input
}

const planArgs = {
  groupSlug: v.string(),
  weekStart: v.string(),
  dates: v.array(v.string()),
  slots: v.array(mealSlotValidator),
  locale: localeValidator,
  wishes: v.array(weekPlanWishValidator),
  wish: v.optional(v.string()),
  avoidRecipeIds: v.optional(v.array(v.string())),
  avoidMealEntryId: v.optional(v.string()),
  avoidQuickMeals: v.optional(v.array(v.string())),
}

/** The planners' input for one plan, read as the calling Member. */
export const context = internalQuery({
  args: planArgs,
  handler: async (ctx, args) => {
    requireWeekStart(args.weekStart)
    return await planContext(ctx, args)
  },
})

const pickValidator = v.object({
  date: v.string(),
  slot: mealSlotValidator,
  recipeId: v.optional(v.string()),
  quickMeal: v.optional(v.string()),
  quickMealId: v.optional(v.string()),
  prepMinutes: v.optional(v.number()),
  reason: v.optional(v.string()),
  source: sourceValidator,
})

/**
 * Store a plan's picks as drafts: the whole week's proposal replaced, or one
 * slot's draft (regenerate). Each pick is checked again here, in the same
 * transaction as the write: its slot must still be empty and in the week, a
 * recipe still visible in the Group, a quick meal id still the Group's.
 */
export const write = internalMutation({
  args: {
    groupSlug: v.string(),
    weekStart: v.string(),
    picks: v.array(pickValidator),
    /** The cleaned wishes the picks were made with, kept on every row. */
    wishes: v.optional(v.array(weekPlanWishValidator)),
    wish: v.optional(v.string()),
    replace: v.union(
      v.object({ kind: v.literal('week') }),
      v.object({ kind: v.literal('draft'), id: v.id('mealPlanDrafts') }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    requireWeekStart(args.weekStart)
    const { group, user } = await requireGroupBySlug(ctx, args.groupSlug)
    const end = addDays(args.weekStart, 6)
    const rows = []
    for (const pick of args.picks) {
      if (!isIsoDate(pick.date) || pick.date < args.weekStart || pick.date > end)
        continue
      if (await mealAt(ctx, group._id, pick.date, pick.slot)) continue
      const fields = await checkedPick(ctx, group._id, pick)
      if (fields) rows.push({ pick, fields })
    }
    // A plan with nothing that still fits keeps the drafts it would replace:
    // the week's open proposal, or the one draft being regenerated.
    if (rows.length === 0) return 0
    if (args.replace.kind === 'week') {
      for (const draft of await draftsOfWeek(ctx, group._id, args.weekStart))
        await ctx.db.delete(draft._id)
    } else {
      // A draft accepted or discarded while it was regenerated is not
      // brought back as a lone or second draft (APP-460).
      const draft = await ctx.db.get(args.replace.id)
      if (!draft || draft.groupId !== group._id) return 0
      await ctx.db.delete(draft._id)
    }
    const expiresAt = Date.now() + DRAFT_LIFETIME_MS
    for (const { pick, fields } of rows) {
      await ctx.db.insert('mealPlanDrafts', {
        groupId: group._id,
        weekStart: args.weekStart,
        date: pick.date,
        slot: pick.slot,
        ...fields,
        reason: pick.reason?.slice(0, 200),
        source: pick.source,
        wishes: args.wishes,
        wish: args.wish,
        createdBy: user._id,
        expiresAt,
      })
    }
    return rows.length
  },
})

async function checkedPick(
  ctx: QueryCtx,
  groupId: Id<'groups'>,
  pick: Infer<typeof pickValidator>,
) {
  if (pick.recipeId) {
    const id = ctx.db.normalizeId('recipes', pick.recipeId)
    const recipe = id ? await ctx.db.get(id) : null
    if (!recipe || !isVisibleToGroups(recipe, [groupId])) return null
    return { recipeId: recipe._id, prepMinutes: recipe.prepMinutes }
  }
  const name = pick.quickMeal?.trim()
  if (!name) return null
  const entryId = pick.quickMealId
    ? ctx.db.normalizeId('mealEntries', pick.quickMealId)
    : null
  const entry = entryId ? await ctx.db.get(entryId) : null
  const own = entry && entry.groupId === groupId ? entry : null
  return {
    quickMeal: own ? own.title : name.slice(0, 60),
    mealEntryId: own?._id,
    prepMinutes: own ? own.prepMinutes : pick.prepMinutes,
  }
}

const proposeResult = v.union(
  v.object({ status: v.literal('limit'), limit: v.number() }),
  v.object({ status: v.literal('empty') }),
  v.object({
    status: v.union(v.literal('ai'), v.literal('fallback')),
    count: v.number(),
    left: v.number(),
    limit: v.number(),
  }),
)
type ProposeResult = Infer<typeof proposeResult>

/**
 * Ask for a plan. The cap is taken before the model is asked; no answer gives
 * the call back and plans by the rules. Returns what the phone says next.
 */
async function runPlan(
  ctx: ActionCtx,
  args: Infer<typeof planArgsObject>,
  replace: { kind: 'week' } | { kind: 'draft'; id: Id<'mealPlanDrafts'> },
): Promise<ProposeResult> {
  // The caller already refused connected apps (`propose`, `regenerate`).
  const identity = await requireIdentity(ctx)
  const input: WeekPlanPromptInput = await ctx.runQuery(
    internal.mealPlanDrafts.context,
    args,
  )
  if (input.targets.length === 0) return { status: 'empty' }

  const taken = await takeRefundableAiCall(ctx, identity.subject)
  if (taken === null) return { status: 'limit', limit: DAILY_AI_CALLS }
  const { used } = taken

  const apiKey = anthropicApiKey()
  // Only a call that never reached the model is given back: an answer the
  // model gave but got wrong was paid for, and the rules fill it in.
  const aiPicks = apiKey ? await askWeekPlan(input, apiKey) : null
  let picks: (WeekPlanPick & { source: 'ai' | 'rules' | 'fallback' })[]
  let spent = used
  if (aiPicks === null) {
    await taken.refund()
    spent = used - 1
    picks = rulesPlan(input).map((pick) => ({ ...pick, source: 'fallback' as const }))
  } else {
    picks = completePlan(aiPicks, input)
  }
  // Nothing to offer keeps the drafts it would replace (`write` again checks
  // what still fits); the phone says so on a count of 0.
  if (picks.length === 0)
    return {
      status: aiPicks === null ? 'fallback' : 'ai',
      count: 0,
      left: DAILY_AI_CALLS - spent,
      limit: DAILY_AI_CALLS,
    }
  const count: number = await ctx.runMutation(internal.mealPlanDrafts.write, {
    groupSlug: args.groupSlug,
    weekStart: args.weekStart,
    picks: picks.map((pick) => ({
      date: pick.date,
      slot: pick.slot,
      recipeId: pick.recipeId,
      quickMeal: pick.quickMeal,
      quickMealId: pick.quickMealId,
      prepMinutes: pick.prepMinutes,
      reason: pick.reason,
      source: pick.source,
    })),
    wishes: args.wishes.length > 0 ? args.wishes : undefined,
    wish: args.wish,
    replace,
  })
  return {
    status: aiPicks === null ? 'fallback' : 'ai',
    count,
    left: DAILY_AI_CALLS - spent,
    limit: DAILY_AI_CALLS,
  }
}

const planArgsObject = v.object(planArgs)

/**
 * Plan mijn week: a proposal for the chosen empty days and slots of one week,
 * replacing the week's open proposal.
 */
export const propose = action({
  args: {
    groupSlug: v.string(),
    weekStart: v.string(),
    dates: v.array(v.string()),
    slots: v.array(mealSlotValidator),
    locale: localeValidator,
    wishes: v.optional(v.array(weekPlanWishValidator)),
    wish: v.optional(v.string()),
  },
  returns: proposeResult,
  handler: async (ctx, args): Promise<ProposeResult> => {
    await rejectConnectedApps(ctx)
    if (args.dates.length > 7) throw new ConvexError('At most a week at once')
    return await runPlan(
      ctx,
      {
        groupSlug: args.groupSlug,
        weekStart: args.weekStart,
        dates: args.dates,
        slots: args.slots,
        locale: args.locale,
        wishes: [],
        ...cleanWishes(args),
      },
      { kind: 'week' },
    )
  },
})

/** The draft and the week's other drafts, for regenerating one slot. */
export const draftFor = internalQuery({
  args: { groupSlug: v.string(), id: v.id('mealPlanDrafts') },
  handler: async (ctx, args) => {
    const { doc, group } = await requireInGroup(ctx, args.groupSlug, args.id, NOT_FOUND)
    if (doc.expiresAt <= Date.now()) throw new ConvexError(NOT_FOUND)
    const others = await draftsOfWeek(ctx, group._id, doc.weekStart)
    return {
      weekStart: doc.weekStart,
      date: doc.date,
      slot: doc.slot,
      mealEntryId: doc.mealEntryId as string | undefined,
      wishes: doc.wishes,
      wish: doc.wish,
      recipeIds: others.flatMap((draft) =>
        draft.recipeId ? [draft.recipeId as string] : [],
      ),
      // This draft's quick meal and the other days'.
      quickMeals: others.flatMap((draft) => (draft.quickMeal ? [draft.quickMeal] : [])),
    }
  },
})

/**
 * Ander voorstel voor {weekday}: a new draft for one slot, never the recipe
 * it replaces nor one already proposed for another day, with the wishes it is
 * sent, else those the draft keeps; the new draft keeps the same. One AI
 * call; with nothing else to propose the draft stays as it was.
 */
export const regenerate = action({
  args: {
    groupSlug: v.string(),
    id: v.id('mealPlanDrafts'),
    locale: localeValidator,
    /**
     * Wishes to ask with instead of the draft's own. Sent by phones that keep
     * the start sheet's wishes in memory (APP-460); since APP-679 the draft
     * has them, and the phone sends none.
     */
    wishes: v.optional(v.array(weekPlanWishValidator)),
    wish: v.optional(v.string()),
  },
  returns: v.union(proposeResult, v.object({ status: v.literal('none') })),
  handler: async (ctx, args): Promise<ProposeResult | { status: 'none' }> => {
    await rejectConnectedApps(ctx)
    const draft: {
      weekStart: string
      date: string
      slot: MealSlot
      mealEntryId?: string
      wishes?: WeekPlanWish[]
      wish?: string
      recipeIds: string[]
      quickMeals: string[]
    } = await ctx.runQuery(internal.mealPlanDrafts.draftFor, {
      groupSlug: args.groupSlug,
      id: args.id,
    })
    const result = await runPlan(
      ctx,
      {
        groupSlug: args.groupSlug,
        weekStart: draft.weekStart,
        dates: [draft.date],
        slots: [draft.slot],
        locale: args.locale,
        ...(cleanWishes(args) ?? { wishes: draft.wishes ?? [], wish: draft.wish }),
        avoidRecipeIds: draft.recipeIds,
        avoidMealEntryId: draft.mealEntryId,
        avoidQuickMeals: draft.quickMeals,
      },
      { kind: 'draft', id: args.id },
    )
    // 0 also covers a draft accepted or discarded meanwhile: nothing is
    // inserted, and the phone's "no other proposal" toast is close enough.
    return 'count' in result && result.count === 0 ? { status: 'none' } : result
  },
})

/**
 * Write one draft into the week as an ordinary Planned meal, if its slot is
 * still empty; the draft goes either way. A recipe the Group can no longer
 * see is not planned. A quick meal the Group does not keep is planned by
 * name only, without adding it to the Group's quick meals.
 */
async function acceptDraft(
  ctx: MutationCtx,
  groupId: Id<'groups'>,
  draft: Doc<'mealPlanDrafts'>,
): Promise<'planned' | 'taken' | 'gone'> {
  await ctx.db.delete(draft._id)
  if (draft.expiresAt <= Date.now()) return 'gone'
  if (await mealAt(ctx, groupId, draft.date, draft.slot)) return 'taken'
  let fields: {
    title: string
    prepMinutes?: number
    recipeId?: Id<'recipes'>
    mealEntryId?: Id<'mealEntries'>
  }
  if (draft.recipeId) {
    const recipe = await ctx.db.get(draft.recipeId)
    if (!recipe || !isVisibleToGroups(recipe, [groupId])) return 'gone'
    fields = {
      title: recipe.title,
      prepMinutes: recipe.prepMinutes,
      recipeId: recipe._id,
    }
  } else {
    const entry = draft.mealEntryId ? await ctx.db.get(draft.mealEntryId) : null
    const own = entry && entry.groupId === groupId ? entry : null
    const title = own ? own.title : draft.quickMeal?.trim()
    if (!title) return 'gone'
    fields = {
      title,
      prepMinutes: own ? own.prepMinutes : draft.prepMinutes,
      mealEntryId: own?._id,
    }
  }
  await ctx.db.insert('plannedDinners', {
    groupId,
    date: draft.date,
    slot: draft.slot,
    ...fields,
  })
  return 'planned'
}

/** Neem over: one draft into the week. */
export const accept = mutation({
  args: { groupSlug: v.string(), id: v.id('mealPlanDrafts') },
  returns: v.union(v.literal('planned'), v.literal('taken'), v.literal('gone')),
  handler: async (ctx, args) => {
    await rejectConnectedApps(ctx)
    const { group, doc } = await requireInGroup(ctx, args.groupSlug, args.id, NOT_FOUND)
    return await acceptDraft(ctx, group._id, doc)
  },
})

/**
 * Neem alle {n} over: every open draft of the week, in one transaction.
 * `planned` and `skipped` count the drafts `list` shows, so they add up to
 * the bar's {n}; a hidden one (expired, its slot filled, its recipe no longer
 * visible) just goes. `slots` are the slots planned, for "net overgenomen"
 * (APP-460); a phone from before ignores it.
 */
export const acceptAll = mutation({
  args: { groupSlug: v.string(), weekStart: v.string() },
  returns: v.object({
    planned: v.number(),
    skipped: v.number(),
    slots: v.array(v.object({ date: v.string(), slot: mealSlotValidator })),
  }),
  handler: async (ctx, args) => {
    await rejectConnectedApps(ctx)
    requireWeekStart(args.weekStart)
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const { drafts, shown } = await shownDrafts(ctx, group._id, args.weekStart)
    const visible = new Set(shown.map(({ draft }) => draft._id))
    let planned = 0
    let skipped = 0
    const slots: { date: string; slot: MealSlot }[] = []
    for (const draft of drafts) {
      const result = await acceptDraft(ctx, group._id, draft)
      if (!visible.has(draft._id)) continue
      if (result === 'planned') {
        planned++
        slots.push({ date: draft.date, slot: draft.slot })
      } else skipped++
    }
    return { planned, skipped, slots }
  },
})

/** Weggooien: the week's proposal goes; nothing in the week changes. */
export const discard = mutation({
  args: { groupSlug: v.string(), weekStart: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    await rejectConnectedApps(ctx)
    requireWeekStart(args.weekStart)
    const { group } = await requireGroupBySlug(ctx, args.groupSlug)
    const drafts = await draftsOfWeek(ctx, group._id, args.weekStart)
    for (const draft of drafts) await ctx.db.delete(draft._id)
    return drafts.length
  },
})

/** Deletes drafts past their 24 hours (cron, hourly). */
export const sweep = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const expired = await ctx.db
      .query('mealPlanDrafts')
      .withIndex('by_expires', (q) => q.lte('expiresAt', Date.now()))
      .take(SWEEP_BATCH)
    for (const draft of expired) await ctx.db.delete(draft._id)
    return expired.length
  },
})
