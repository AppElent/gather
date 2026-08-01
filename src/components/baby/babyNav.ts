import type { AppLink } from '../../lib/appLink'
import { groupLink } from '../../lib/groupPaths'

/**
 * Everywhere the Baby log pages can send you.
 *
 * The baby log is Group-scoped content (CONTEXT.md): a child belongs to one
 * household, and both parents see it because they are Members of that Group.
 * So the Group in these URLs is not decoration - it says which household's log
 * you are reading, and the pages ask Convex for exactly that one.
 */
export interface BabyNav {
  list: AppLink
  create: AppLink
  detail: (babyId: string) => AppLink
  edit: (babyId: string) => AppLink
}

export function groupBabyNav(groupSlug: string): BabyNav {
  return {
    list: groupLink('baby', groupSlug),
    create: groupLink('newChild', groupSlug),
    detail: (babyId) => groupLink('child', groupSlug, { babyId }),
    edit: (babyId) => groupLink('editChild', groupSlug, { babyId }),
  }
}
