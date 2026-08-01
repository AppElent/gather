import { useLocation } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { groupSlugOf } from '../../lib/groupPaths'

/** A Group as the shell needs it: enough to name it and link to it. */
export interface ShellGroup {
  _id: string
  name: string
  slug: string
  isPersonal: boolean
}

/**
 * The Group the address bar says you are in, and all the Groups you could be in.
 *
 * The shell renders above both route trees, so it cannot use `useGroup()` — that
 * only exists inside the gate. The URL is the only thing that says which Group
 * you are in (ADR-0002), and this is where the shell reads it.
 *
 * `current` is null off any `/g/<slug>` route, and null for a slug that is not
 * yours. Neither is an error: the shell says it has no Group to name rather than
 * picking one, because guessing is how the Group became invisible in the first
 * place.
 */
export function useCurrentGroup(): {
  current: ShellGroup | null
  groups: ShellGroup[] | undefined
  slug: string | null
} {
  const location = useLocation()
  const groups = useQuery(api.groups.myGroups)
  const slug = groupSlugOf(location.pathname)

  return {
    current: groups?.find((group) => group.slug === slug) ?? null,
    groups,
    slug,
  }
}
