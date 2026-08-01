import type { AppLink } from '../../lib/appLink'
import { groupHref, groupLink } from '../../lib/groupPaths'

/**
 * Where the Tasks page points, and where it comes back to.
 *
 * Tasks has no detail pages, so this is smaller than the other Modules - but it
 * does have a round-trip out of the app and back. Connecting Notion or Todoist
 * leaves for the provider and returns through /integrations/callback, which
 * needs somewhere to send you afterwards. That destination has to be a plain
 * path because it survives in sessionStorage across a full page load, and it
 * has to carry the Group for the same reason every other link does.
 */
export interface TaskNav {
  list: AppLink
  /** Where the provider OAuth round-trip lands, as a plain path. */
  returnTo: string
}

export function groupTaskNav(groupSlug: string): TaskNav {
  return {
    list: groupLink('tasks', groupSlug),
    returnTo: groupHref('tasks', groupSlug),
  }
}
