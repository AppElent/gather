/**
 * What a Drop is made of, and which destination a host argues for.
 *
 * A Drop is what another app hands to Gather through the phone's share sheet —
 * a link, some text, a photo — before it is anything in Gather (ADR-0028). The
 * *destinations* it can be aimed at are the phone's business and live in
 * `apps/mobile/src/drop/dropTargets.ts`, because they carry typed routes. What
 * is here is the part that has no client in it: the payload kinds, and a table
 * of hosts that says which Module a link from that host usually belongs to.
 *
 * It lives in the shared package so the web's own importer can adopt the
 * negative half without a second table — the guard against spending several
 * seconds and one model call on a page that was never going to contain a
 * recipe.
 *
 * **Host rules preselect and never restrict.** Nothing here removes a
 * destination from anything; it only says which one to put on top. A stale rule
 * therefore costs one tap, never a dead end, which is what makes the table safe
 * to write from memory and cheap to leave slightly wrong.
 */

/**
 * The payload kinds Gather declares in the share sheet.
 *
 * Declaring a kind is a native manifest commitment, so the list is exactly what
 * the app can place — appearing in the sheet for something Gather cannot do
 * anything with is worse than not appearing at all.
 */
export const DROP_KINDS = ['url', 'text', 'image'] as const

export type DropKind = (typeof DROP_KINDS)[number]

/**
 * The Modules a host rule is allowed to argue for.
 *
 * Not `ModuleId`: a rule points at a Module that actually reads what arrives,
 * and today that is Recipes (which reads a page) or Notes (which keeps the link
 * as it stands). Widening this is a decision, not a typo.
 */
export type DropHostPreference = 'recipes' | 'notes'

/**
 * Hosts whose links usually belong somewhere in particular.
 *
 * The **negative** entries are the ones that earn their keep today: a video,
 * social or map page has no recipe structured data, so without a rule it falls
 * through the importer to the model fallback and fails several seconds and one
 * paid call later. Pointing them at Notes makes the common answer the first
 * one, and Recipes is still on the sheet for the cooking video that really does
 * have a recipe in its description.
 *
 * The **positive** entries change no behaviour on the day they are written,
 * since Recipes already wins for a URL by declared order. They are here to
 * record intent, and they hold if that default ever moves.
 *
 * Keys are bare hosts. Matching strips `www.` and then walks up the labels, so
 * `m.youtube.com` and `www.youtube.com` both find `youtube.com` while
 * `maps.google.com` can be listed without claiming all of Google.
 */
export const DROP_HOST_RULES: Readonly<Record<string, DropHostPreference>> = {
  // Video and social — no recipe markup, and the model fallback cannot read a
  // video either.
  'youtube.com': 'notes',
  'youtu.be': 'notes',
  'vimeo.com': 'notes',
  'tiktok.com': 'notes',
  'instagram.com': 'notes',
  'facebook.com': 'notes',
  'x.com': 'notes',
  'twitter.com': 'notes',
  'reddit.com': 'notes',
  'pinterest.com': 'notes',
  // Maps — a place is a thing to remember, never a thing to cook.
  'maps.google.com': 'notes',
  'maps.apple.com': 'notes',
  'openstreetmap.org': 'notes',
  'waze.com': 'notes',
  // Recipe sites, starting with the one this household actually uses.
  'leukerecepten.nl': 'recipes',
  'ah.nl': 'recipes',
  '24kitchen.nl': 'recipes',
  'allrecipes.com': 'recipes',
  'bbcgoodfood.com': 'recipes',
  'seriouseats.com': 'recipes',
}

/**
 * The host part of a shared link, lowercased and without `www.`.
 *
 * Returns `null` rather than throwing for anything that is not a parseable
 * absolute URL. A share sheet hands over whatever the source app put on the
 * pasteboard, and a Drop with an unusable link is still a Drop — it simply gets
 * the declared order instead of a rule.
 */
export function dropHost(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  const host = parsed.hostname.toLowerCase()
  return host.startsWith('www.') ? host.slice(4) : host
}

/**
 * Which Module this host argues for, if any.
 *
 * Walks up the labels so a rule written for a site covers its subdomains
 * without every one of them being listed. `null` means no rule, which is not a
 * refusal — it is the declared order having nothing to override it.
 */
export function dropHostPreference(
  host: string | null,
): DropHostPreference | null {
  if (!host) return null
  const labels = host.split('.')
  for (let i = 0; i < labels.length - 1; i += 1) {
    const candidate = labels.slice(i).join('.')
    const rule = DROP_HOST_RULES[candidate]
    if (rule) return rule
  }
  return null
}
