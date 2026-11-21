/**
 * Whether a system link is an old `/g/<slug>/…` address (ADR-0015, superseded
 * by ADR-0031). The phone no longer opens one (APP-81); `+native-intent.tsx`
 * sends it to `/` instead, leaving the current Group as it was.
 *
 * Matches `gather://g/…`, `gather:///g/…` and `/g/…` under any scheme, but not
 * a route that merely starts with a g, such as `/groceries`.
 */
const OLD_GROUP_LINK = /^(?:[a-z][a-z0-9+.-]*:)?\/*g(?:[/?#]|$)/i

export function isOldGroupLink(path: string): boolean {
  return OLD_GROUP_LINK.test(path)
}
