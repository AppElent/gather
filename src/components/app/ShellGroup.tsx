import { useLocation } from '@tanstack/react-router'
import { createContext, type ReactNode, useContext, useState } from 'react'
import { groupSlugOf } from '../../lib/groupPaths'
import { type ShellGroup, useCurrentGroup } from './useCurrentGroup'

/**
 * The last Group the address bar named, kept for the shell to draw with.
 *
 * Following "Groups" out of a Group used to empty the shell: the module list
 * became "Pick a group to see its modules.", and the dock unmounted. Leaving
 * *to* the list of Groups is not leaving your Group, and a sidebar that goes
 * blank on the way says it is.
 *
 * This is deliberately not a second answer to "which Group am I in". ADR-0002
 * gives that answer to the URL and nothing else, and every read and write in
 * the app still asks the URL — `useCurrentGroup` below is untouched, the gate
 * is untouched, and no request carries this slug. It is only what the shell
 * draws while standing somewhere that names no Group at all: `/groups`,
 * `/settings`, `/account`. On any `/g/<slug>` route the URL wins outright,
 * because there is nothing here that could disagree with it.
 *
 * Kept in React state rather than storage, so it lives exactly as long as the
 * shell does. Two tabs sitting in two Groups keep two memories, the same way
 * they keep two URLs.
 */
const LastGroupSlugContext = createContext<string | null>(null)

export function ShellGroupProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const addressed = groupSlugOf(location.pathname)
  const [last, setLast] = useState<string | null>(addressed)

  // Derived during render on purpose: an effect would paint one frame of the
  // empty shell first, which is the exact flicker this exists to remove.
  if (addressed && addressed !== last) setLast(addressed)

  return (
    <LastGroupSlugContext.Provider value={addressed ?? last}>
      {children}
    </LastGroupSlugContext.Provider>
  )
}

export interface ShellGroupState {
  /** The Group to draw the navigation for — addressed, or last addressed. */
  group: ShellGroup | null
  /** Its slug, or null when no Group has been visited yet this session. */
  slug: string | null
  /** Every Group the reader is in, for the switcher. */
  groups: ShellGroup[] | undefined
  /** Whether `group` is the one the URL names, rather than one remembered. */
  addressed: boolean
}

/**
 * What the shell should render — as against `useCurrentGroup`, which says what
 * the URL means.
 *
 * Only the navigation surfaces use this: the sidebar's module list, the dock,
 * and the switcher's label. Anything that states a fact about where the reader
 * *is* — the topbar's heading, the Gather panel's Group — keeps asking
 * `useCurrentGroup`, because on `/settings` the honest answer is still that you
 * are in no Group.
 */
export function useShellGroup(): ShellGroupState {
  const remembered = useContext(LastGroupSlugContext)
  const { current, groups, slug } = useCurrentGroup()

  if (current) return { group: current, slug, groups, addressed: true }

  // Resolved against the Groups you are in, so a remembered slug you have since
  // been removed from draws nothing rather than a name you cannot open.
  const group = groups?.find((g) => g.slug === remembered) ?? null
  return { group, slug: group?.slug ?? null, groups, addressed: false }
}
