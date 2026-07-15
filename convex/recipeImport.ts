'use node'

import { ConvexError, v } from 'convex/values'
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

// Blocks the obvious SSRF targets (loopback, RFC1918 private ranges,
// link-local incl. cloud metadata IPs, IPv6 loopback/unique-local/link-local,
// and non-http(s) schemes). Not a general-purpose SSRF-proof resolver — e.g.
// it doesn't follow redirects or catch decimal/hex-obfuscated IP literals —
// just enough to reject the obvious internal-network cases.
export function isUrlSafeToFetch(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost')) return false

  // Only apply IPv6-literal checks to things that actually look like IPv6
  // (otherwise this wrongly rejects real hostnames like fcbarcelona.com).
  if (host.includes(':')) {
    // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1, or Node's normalized
    // ::ffff:7f00:1 hex form) can wrap a loopback/private IPv4 address —
    // reject the whole family outright rather than trying to unwrap it.
    if (host.includes('::ffff:')) return false
    // IPv6 loopback, unique-local (fc00::/7), and link-local (fe80::/10)
    if (host === '::1' || host === '::') return false
    if (host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) {
      return false
    }
    return true
  }

  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (ipv4Match) {
    const a = Number(ipv4Match[1])
    const b = Number(ipv4Match[2])
    if (a === 127) return false // loopback
    if (a === 10) return false // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return false // 172.16.0.0/12
    if (a === 192 && b === 168) return false // 192.168.0.0/16
    if (a === 169 && b === 254) return false // link-local, incl. cloud metadata
    if (a === 0) return false // 0.0.0.0/8
  }

  return true
}

export const importFromUrl = action({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError('Not authenticated')

    if (!isUrlSafeToFetch(args.url)) throw new ConvexError(BLOCKED_MESSAGE)

    let html: string
    try {
      const response = await fetch(args.url, {
        headers: { 'User-Agent': IMPORT_USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (!response.ok) throw new Error('fetch not ok')
      html = await response.text()
    } catch {
      throw new ConvexError(BLOCKED_MESSAGE)
    }

    let parsed = extractJsonLdRecipe(html)
    if (!parsed) {
      const apiKey = process.env.ANTHROPIC_API_KEY
      parsed = apiKey ? await extractRecipeWithAi(htmlToText(html), apiKey) : null
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
    }
  },
})

async function storeRemoteImage(
  ctx: ActionCtx,
  url: string,
): Promise<Id<'_storage'> | undefined> {
  if (!isUrlSafeToFetch(url)) return undefined
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
