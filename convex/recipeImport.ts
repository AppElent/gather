'use node'

import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { action } from './_generated/server'
import type { ActionCtx } from './_generated/server'
import { extractRecipeWithAi } from './lib/recipeAiExtract'
import { extractJsonLdRecipe, htmlToText } from './lib/recipeParsing'

const IMPORT_USER_AGENT =
  'Mozilla/5.0 (compatible; GatherRecipeImport/1.0; +https://github.com/AppElent/gather)'
const FETCH_TIMEOUT_MS = 10_000
const BLOCKED_MESSAGE =
  'That site blocks automated access — try pasting the recipe manually.'
const NOT_FOUND_MESSAGE =
  "Couldn't find a recipe on that page — try pasting the details manually."

export const importFromUrl = action({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    let html: string
    try {
      const response = await fetch(args.url, {
        headers: { 'User-Agent': IMPORT_USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (!response.ok) throw new Error('fetch not ok')
      html = await response.text()
    } catch {
      throw new Error(BLOCKED_MESSAGE)
    }

    let parsed = extractJsonLdRecipe(html)
    if (!parsed) {
      const apiKey = process.env.ANTHROPIC_API_KEY
      parsed = apiKey ? await extractRecipeWithAi(htmlToText(html), apiKey) : null
    }
    if (!parsed) throw new Error(NOT_FOUND_MESSAGE)

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
    }
  },
})

async function storeRemoteImage(
  ctx: ActionCtx,
  url: string,
): Promise<Id<'_storage'> | undefined> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return undefined
    const blob = await res.blob()
    return await ctx.storage.store(blob)
  } catch {
    return undefined
  }
}
