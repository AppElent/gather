'use node'

import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { action } from './_generated/server'
import { takeAiCall } from './lib/aiUsage'
import { anthropicApiKey } from './lib/anthropic'
import { GROUP_REFUSAL_MESSAGES } from './lib/groupAccess'
import { extractRecipeWithAi } from './lib/recipeAiExtract'
import { extractJsonLdRecipe, htmlToText } from './lib/recipeParsing'
import { isUrlSafeToFetch, safeFetch, storeRemoteImage } from './lib/safeFetch'
import { requireIdentity } from './lib/sharing'

const IMPORT_USER_AGENT =
  'Mozilla/5.0 (compatible; GatherRecipeImport/1.0; +https://github.com/AppElent/gather)'
const FETCH_TIMEOUT_MS = 10_000
const BLOCKED_MESSAGE =
  'That site blocks automated access — try pasting the recipe manually.'
const NOT_FOUND_MESSAGE =
  "Couldn't find a recipe on that page — try pasting the details manually."

/**
 * Fetch and parse a recipe for the form to be filled in with.
 *
 * It takes the Group it is importing *for*, and refuses one the caller is not a
 * Member of. Nothing is written to that Group here — the recipe is created by
 * `recipes.create` when the form is saved — but an import belongs to a
 * destination the moment it is started, and an import surface that shrugged at
 * which Group it was aimed at is what lets a page decide silently.
 */
export const importFromUrl = action({
  args: { url: v.string(), groupSlug: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)

    // An action has no `ctx.db` and so cannot call `requireGroupBySlug` itself.
    // `groups.bySlug` is that same resolver behind a query, and refuses for the
    // same three reasons in the same words.
    const group = await ctx.runQuery(internal.groups.bySlug, {
      slug: args.groupSlug,
    })
    if (!group.ok) throw new ConvexError(GROUP_REFUSAL_MESSAGES[group.reason])

    if (!isUrlSafeToFetch(args.url)) throw new ConvexError(BLOCKED_MESSAGE)

    let html: string
    try {
      const response = await safeFetch(args.url, {
        headers: { 'User-Agent': IMPORT_USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (!response?.ok) throw new Error('fetch not ok')
      html = await response.text()
    } catch {
      throw new ConvexError(BLOCKED_MESSAGE)
    }

    let parsed = extractJsonLdRecipe(html)
    let nutritionSource: 'imported' | 'ai' | undefined = parsed?.nutrition
      ? 'imported'
      : undefined
    if (!parsed) {
      const apiKey = anthropicApiKey()
      // Only the fallback spends a call: a page with JSON-LD is free, which is
      // why the budget is taken here and not on entry.
      if (apiKey) await takeAiCall(ctx, identity.subject)
      parsed = apiKey
        ? await extractRecipeWithAi(htmlToText(html), apiKey)
        : null
      if (parsed?.nutrition) nutritionSource = 'ai'
    }
    if (!parsed) throw new ConvexError(NOT_FOUND_MESSAGE)

    const imageId = parsed.imageUrl
      ? await storeRemoteImage(ctx, parsed.imageUrl)
      : undefined
    const imageUrl = imageId ? await ctx.storage.getUrl(imageId) : null

    return {
      title: parsed.title,
      description: parsed.description,
      ingredients: parsed.ingredients,
      steps: parsed.steps,
      tags: parsed.tags,
      prepMinutes: parsed.prepMinutes,
      imageId,
      imageUrl,
      sourceUrl: args.url,
      servings: parsed.servings,
      nutrition: parsed.nutrition,
      nutritionSource,
    }
  },
})
