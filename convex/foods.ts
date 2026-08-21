import { ConvexError, v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import { foodSearchText } from './lib/foodSearchText'
import {
  hasNutritionFigures,
  nextNutritionSource,
  nutritionSourceValidator,
  nutritionValidator,
} from './lib/nutrition'
import { servingValidator } from './lib/servings'
import { getCurrentUser } from './lib/sharing'
import { deleteStoredFile, replaceStoredFile } from './lib/storedFiles'

const foodFields = {
  name: v.string(),
  brand: v.optional(v.string()),
  baseUnit: v.union(v.literal('g'), v.literal('ml')),
  nutritionPer100: nutritionValidator,
  servings: v.optional(v.array(servingValidator)),
}

/**
 * The fields a *person* saves, which is `foodFields` plus the emoji they
 * picked (#94).
 *
 * Separate from `foodFields` because of the one write that is not a person
 * saying what this food is: `applyOffRefresh` replaces a row wholesale with
 * Open Food Facts' answer, and Open Food Facts has no emoji. A refresh
 * therefore leaves the icon you chose exactly where it was, rather than
 * clearing it on your behalf.
 *
 * Absent means none. It is never stored as an empty string — a set-but-empty
 * icon would sit in front of the generic glyph in the tile's fallback chain
 * and render nothing at all.
 *
 * Three states, not two, which is why `null` is in the type. Convex drops an
 * argument whose value is `undefined` before it reaches the server, so an
 * optional string can only say "a person chose this one" or nothing at all —
 * and "nothing at all" would have to mean both *leave what is there* and
 * *take it off*. `null` is the clear, because it survives the wire; omitting
 * the field leaves the icon alone, which is what any caller that does not
 * know about icons should do.
 */
const savedFoodFields = {
  ...foodFields,
  icon: v.optional(v.union(v.string(), v.null())),
}

/**
 * The patch fragment for an icon argument, given the three states above.
 *
 * `{}` when omitted, so a spread leaves the stored icon untouched; a written
 * key of `undefined` when cleared, because writing `undefined` is what makes
 * Convex *remove* a field rather than skip it.
 */
function iconPatch(icon: string | null | undefined) {
  return icon === undefined ? {} : { icon: icon ?? undefined }
}

/**
 * Catalog entries are owned by nobody and read-only (ADR 0004). Every write
 * path into `foods` goes through this, not just the edit form: these are
 * public mutations, so a client can call any of them with any food id
 * regardless of what the UI offers. Allowing a write would be worse than
 * refusing it — the next Catalog seed overwrites unconditionally, so the
 * change would silently revert.
 */
function assertNotCatalog(food: Doc<'foods'>) {
  if (food.seedKey !== undefined) {
    throw new ConvexError(
      'This is a built-in catalog food and cannot be changed. Create a new food instead.',
    )
  }
}

/**
 * A food as a reader gets it: the row, plus a URL for its picture.
 *
 * The row holds a `_storage` id, which is no use to an `<img>`. Resolving it
 * here rather than in the client is what keeps a result list one round trip.
 */
async function withImageUrl(ctx: QueryCtx, food: Doc<'foods'>) {
  return {
    ...food,
    imageUrl: food.imageId ? await ctx.storage.getUrl(food.imageId) : null,
  }
}

export const search = query({
  args: { term: v.string() },
  handler: async (ctx, args) => {
    if (!(await getCurrentUser(ctx))) return []
    if (!args.term.trim()) return []
    const rows = await ctx.db
      .query('foods')
      .withSearchIndex('search_by_text', (q) =>
        q.search('searchText', args.term),
      )
      .take(20)
    return await Promise.all(rows.map((row) => withImageUrl(ctx, row)))
  },
})

/** How much of the Catalog a browse shows before somebody narrows it. */
const BROWSE_LIMIT = 100

/**
 * The Catalog to browse, rather than to search.
 *
 * `search` answers an empty term with nothing, and rightly — a full-text index
 * has no meaning for `''`. But that left the Foods page blank until somebody
 * typed, which made a catalog you are meant to be able to look through feel
 * like one you have to guess at (#100 review). This is the other half of the
 * page: the Catalog itself, in alphabetical order.
 *
 * Ordered by the `by_name` index rather than sorted after the fact: `take`
 * has to cut the Catalog somewhere, and cutting it before sorting would make
 * the first page whatever the table happened to return — not the first page
 * alphabetically. `foods` is one globally readable table, so it passes a
 * hundred rows on somebody else's account rather than on the seed's.
 *
 * The index orders by raw name, so the page is chosen by that; the sort below
 * only settles how those same rows read to a person, where case and accents
 * matter and byte order does not. If the Catalog outgrows one page, this is
 * where cursor paging goes — not a bigger limit.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    if (!(await getCurrentUser(ctx))) return []
    const rows = await ctx.db
      .query('foods')
      .withIndex('by_name')
      .take(BROWSE_LIMIT)
    return await Promise.all(
      [...rows]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((row) => withImageUrl(ctx, row)),
    )
  },
})

export const get = query({
  args: { id: v.id('foods') },
  handler: async (ctx, args) => {
    if (!(await getCurrentUser(ctx))) return null
    const food = await ctx.db.get(args.id)
    return food ? await withImageUrl(ctx, food) : null
  },
})

export const getByBarcode = query({
  args: { barcode: v.string() },
  handler: async (ctx, args) => {
    if (!(await getCurrentUser(ctx))) return null
    const food = await ctx.db
      .query('foods')
      .withIndex('by_barcode', (q) => q.eq('barcode', args.barcode))
      .unique()
    return food ? await withImageUrl(ctx, food) : null
  },
})

// Manual creation. If a barcode is supplied and a row already has it (e.g.
// the user scanned first, OFF had nothing, and they're filling it in by
// hand), reuse that row instead of creating a duplicate — the "no duplicate
// row per barcode" invariant applies here too, not just to `upsertFromOff`.
export const create = mutation({
  args: {
    ...savedFoodFields,
    barcode: v.optional(v.string()),
    // What the person was looking at when they pressed save: figures they
    // typed are `manual`, figures something filled in for them and they
    // accepted keep whatever the form was showing. Absent means manual,
    // which is what typing into an empty form is.
    nutritionSource: v.optional(nutritionSourceValidator),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    if (args.barcode) {
      const existing = await ctx.db
        .query('foods')
        .withIndex('by_barcode', (q) => q.eq('barcode', args.barcode))
        .unique()
      if (existing) return existing._id
    }
    return await ctx.db.insert('foods', {
      ...args,
      // Nothing to leave alone on a new row: both "omitted" and "cleared" are
      // simply no icon.
      icon: args.icon ?? undefined,
      nutritionSource: hasNutritionFigures(args.nutritionPer100)
        ? (args.nutritionSource ?? 'manual')
        : undefined,
      searchText: foodSearchText(args),
      source: 'manual',
      createdBy: user._id,
    })
  },
})

// Any edit through the general edit form counts as a local edit: from this
// point on, a rescan of this barcode must never silently overwrite what the
// user typed, until they explicitly ask to refresh.
export const update = mutation({
  args: {
    id: v.id('foods'),
    ...savedFoodFields,
    barcode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const { id, icon, ...rest } = args
    const food = await ctx.db.get(id)
    if (!food) throw new Error('Food not found')
    assertNotCatalog(food)
    if (food.createdBy !== user._id) {
      throw new ConvexError(
        'Only the person who created this food can edit it.',
      )
    }
    await ctx.db.patch(id, {
      ...rest,
      // An absent `servings` means "none" rather than "leave what is there":
      // the form sends nothing once every row has been removed, and a patch
      // that skipped the field would make the last serving undeletable.
      servings: rest.servings ?? [],
      // The icon reads the opposite way round, and has to say which it means
      // rather than leave it to whether the key arrived: the edit form clears
      // one by sending `null`, and a caller that says nothing about icons
      // keeps the one that is there.
      ...iconPatch(icon),
      searchText: foodSearchText(rest),
      // Decided here, from the figures themselves, rather than accepted as an
      // argument — this mutation is the one place a person can type over a
      // food's nutrition, and it must not be possible to do that while still
      // claiming the numbers came off a packet. A save that renames the food
      // and leaves the figures alone changes nothing about where they came
      // from, including leaving a row that never recorded one still silent.
      nutritionSource: nextNutritionSource(
        food.nutritionPer100,
        rest.nutritionPer100,
        food.nutritionSource,
      ),
      localEdited: true,
    })
  },
})

// Called after a successful OFF lookup + user confirmation: upserts by
// barcode so a rescan never creates a duplicate row. A row a human has
// already edited (`localEdited`) is left untouched — only the explicit
// "refresh from Open Food Facts" flow (`applyOffRefresh` below) may
// overwrite local edits.
export const upsertFromOff = mutation({
  args: {
    ...savedFoodFields,
    barcode: v.string(),
    // Either already fetched by `foodsLookup.importFromOff`, or omitted for
    // a fast add-sheet import whose picture follows in the background.
    imageId: v.optional(v.id('_storage')),
    // A direct import uses `imported`; a person who checked first and
    // corrected the figures sends `manual` instead, and the food says the
    // true thing about the numbers it actually carries (#112).
    nutritionSource: v.optional(nutritionSourceValidator),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const { barcode, nutritionSource, icon, ...withoutSource } = args
    const rest = {
      ...withoutSource,
      nutritionSource: hasNutritionFigures(args.nutritionPer100)
        ? (nutritionSource ?? ('imported' as const))
        : undefined,
    }
    const existing = await ctx.db
      .query('foods')
      .withIndex('by_barcode', (q) => q.eq('barcode', barcode))
      .unique()
    if (existing) {
      // No Catalog fixture carries a barcode today, so this is unreachable —
      // but the invariant belongs to the table, not to the current fixtures.
      assertNotCatalog(existing)
      if (existing.localEdited) {
        // Nothing is written, so the picture just fetched for this import is
        // already unreachable. Deleting it here is what keeps "a blob lives
        // exactly as long as a row points at it" true of a refused import.
        await deleteStoredFile(ctx, rest.imageId)
        return existing._id
      }
      const previousImageId = existing.imageId
      await ctx.db.patch(existing._id, {
        ...rest,
        searchText: foodSearchText(rest),
        // Handled the same way as in `update`: the review form states what this
        // food is, icon included, so an import whose reviewer took the icon off
        // sends `null` and it goes, while an import that never mentions one
        // leaves what is there.
        ...iconPatch(icon),
      })
      await replaceStoredFile(ctx, previousImageId, rest.imageId)
      return existing._id
    }
    return await ctx.db.insert('foods', {
      ...rest,
      searchText: foodSearchText(rest),
      // A new row has nothing to leave alone, so both "omitted" and "cleared"
      // are simply no icon.
      icon: icon ?? undefined,
      barcode,
      source: 'openfoodfacts',
      createdBy: user._id,
    })
  },
})

/**
 * Attaches an OFF image after its food is already available to log.
 *
 * An import writes its row before downloading the optional image so the
 * external host never delays the add-sheet return. If a row gained an image
 * while the fetch was in flight, keep that newer one and delete this
 * unreachable blob instead.
 */
export const attachOffImage = mutation({
  args: { id: v.id('foods'), imageId: v.id('_storage') },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const food = await ctx.db.get(args.id)
    if (!food) {
      await deleteStoredFile(ctx, args.imageId)
      return
    }
    // The upload may finish after somebody corrects the food in the add sheet.
    // Treat that exactly like the rescan path: their local edit wins, and this
    // no-longer-needed file is removed.
    if (food.seedKey !== undefined || food.localEdited || food.imageId) {
      await deleteStoredFile(ctx, args.imageId)
      return
    }
    await ctx.db.patch(food._id, { imageId: args.imageId })
  },
})

// Applies a fresh Open Food Facts fetch over an existing row and clears
// localEdited. Only ever called by the `refreshFromOff` action (a future
// task, `convex/foodsLookup.ts`) after an explicit user confirmation — never
// automatically, and never from `update`/`upsertFromOff`.
export const applyOffRefresh = mutation({
  args: { id: v.id('foods'), ...foodFields, barcode: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const { id, ...rest } = args
    const food = await ctx.db.get(id)
    if (!food) throw new Error('Food not found')
    // `barcode` arrives as an argument rather than being read off the row, so
    // the "this food has no barcode" check in `foodsLookup.refreshFromOff` is
    // no protection here — a client can call this mutation directly with any
    // food id at all.
    assertNotCatalog(food)
    await ctx.db.patch(id, {
      ...rest,
      searchText: foodSearchText(rest),
      source: 'openfoodfacts',
      // A refresh replaces the figures wholesale with Open Food Facts', so
      // whatever they used to be, that is where they come from now — unless
      // it came back with none, which claims nothing.
      nutritionSource: hasNutritionFigures(rest.nutritionPer100)
        ? 'imported'
        : undefined,
      localEdited: false,
    })
  },
})
