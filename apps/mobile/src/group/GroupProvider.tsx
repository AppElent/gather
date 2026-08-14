/**
 * The Group you are in, which on a phone is a place rather than an address.
 *
 * ADR-0015: the web reads the Group out of `/g/<slug>/…` and can therefore hold
 * two Groups open in two tabs. There is one foreground app here, so the Group
 * lives in this context, is retained locally between launches, and is
 * **validated against `groups.myGroups` on every read**. Being removed from a
 * Group is a real event; a retained slug is a guess about a membership that may
 * have ended while the app was closed.
 *
 * The decision itself is `selectGroup` in `@gather/core/groups` — pure, shared
 * with the web's landing redirect, and tested in the Node seam. What is left
 * here is the three things only a client can do: read the retained slug,
 * persist a new one, and decide what to draw while the answer is not `ready`.
 *
 * Three states, and no fourth:
 *
 * - **pending** — the Groups have not arrived, or they have arrived empty and
 *   the grace period below has not run out. Nothing Group-scoped can render.
 * - **none** — the Member really is in no Group.
 * - **ready** — `useGroup()` answers, and every surface under it can rely on it.
 *
 * `EMPTY_GRACE_MS` is the web's constant, ported for the same reason it exists
 * there: `ensureUser` inserts everybody's Personal group on the same mount that
 * first asks for the list, so a first-ever launch answers empty and fills in a
 * round-trip later. Believing that immediately would greet a new arrival with a
 * screen about having no household moments before they have one.
 */
import { selectGroup } from '@gather/core/groups'
import { useConvexAuth, useQuery } from 'convex/react'
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { readRetainedGroup, writeRetainedGroup } from './retainedGroup'

/** How long an empty list of Groups is treated as one that has not finished
 * arriving. Long enough for `ensureUser` to insert a Personal group and for the
 * query to push the new answer back; short enough that a genuinely group-less
 * account is not left watching a spinner. */
const EMPTY_GRACE_MS = 5000

/** A Group as the phone needs it: enough to name it, switch to it, and scope a
 * query by it. */
export interface AmbientGroup {
  _id: Id<'groups'>
  name: string
  slug: string
  isPersonal: boolean
}

export interface GroupContextValue {
  /** The Group everything on screen is in. */
  group: AmbientGroup
  /** Every Group this Member is in, in the order the backend returns them. */
  groups: AmbientGroup[]
  /**
   * Move to another Group. Ignores a slug the Member is not in, because the
   * only way to obtain one is a stale list, and honouring it would put the app
   * in a Group the backend then refuses every query for.
   *
   * ADR-0015 also requires a switch to unwind every tab stack. That belongs
   * with the tabs (#162) — there are none yet — and this is the seam it hooks
   * onto.
   */
  setGroup: (slug: string) => void
}

const GroupContext = createContext<GroupContextValue | null>(null)

/**
 * The ambient Group. Throws outside a resolved provider rather than returning
 * null: a Group-scoped screen that renders without one is a wiring bug, not a
 * state every screen has to re-handle. `GroupProvider` does not render its
 * children until there is an answer, so inside them there always is one.
 */
export function useGroup(): GroupContextValue {
  const value = use(GroupContext)
  if (!value) {
    throw new Error('useGroup must be used within a resolved GroupProvider')
  }
  return value
}

export interface GroupProviderProps {
  children: ReactNode
  /** Drawn while the Groups have not arrived. */
  pending: ReactNode
  /** Drawn when the Member is in no Group at all. */
  none: ReactNode
}

export function GroupProvider({ children, pending, none }: GroupProviderProps) {
  // Read once, synchronously, before the first paint. An awaited read would
  // mean a frame in the wrong Group on every cold start.
  const [retained, setRetained] = useState(readRetainedGroup)
  const [graceElapsed, setGraceElapsed] = useState(false)

  // Skipped until Convex has the token, and this is not the redirect trap:
  // nothing here navigates on `isAuthenticated`. It is `groups.myGroups`
  // returning `[]` for a caller it cannot identify — an answer that is
  // indistinguishable from "you are in no Group" and is not one. Asked without
  // identity, a dropped token would tear the whole navigator down and then
  // announce that the Member has no household. Skipping keeps that case where
  // it belongs, in `pending`.
  const { isAuthenticated } = useConvexAuth()
  const myGroups = useQuery(api.groups.myGroups, isAuthenticated ? {} : 'skip')
  const groups = useMemo<AmbientGroup[] | undefined>(
    () =>
      myGroups?.map(({ _id, name, slug, isPersonal }) => ({
        _id,
        name,
        slug,
        isPersonal,
      })),
    [myGroups],
  )

  const selection = selectGroup(retained, groups)

  // Runs out once and stays run out — it is only ever consulted while the
  // answer is `none`, so there is nothing to reset it for. The cost is that
  // leaving your last Group with the app open spends five seconds on the
  // pending screen before the honest one; the alternative is a new account
  // being told it has no household in the gap before it has one.
  useEffect(() => {
    if (selection.status !== 'none') return
    const settle = setTimeout(() => setGraceElapsed(true), EMPTY_GRACE_MS)
    return () => clearTimeout(settle)
  }, [selection.status])

  const slug = selection.status === 'ready' ? selection.slug : null

  // A fallback replaces what was retained, in memory as well as on disk. Not
  // doing so leaves a slug that is not where anybody is: a Member removed from
  // the Group they left the app in would be bounced off it again on every
  // launch, and — worse — being *re-added* to it later in the same session
  // would make the stale slug match again and silently yank them out of the
  // Group they were reading.
  //
  // Adjusting state during render rather than in an effect is React's own
  // pattern for this, and it converges in one pass: a slug that resolves to
  // itself produces no further update.
  if (slug !== null && slug !== retained) setRetained(slug)

  useEffect(() => {
    if (slug) writeRetainedGroup(slug)
  }, [slug])

  const setGroup = useCallback(
    (next: string) => {
      if (!groups?.some((candidate) => candidate.slug === next)) return
      setRetained(next)
    },
    [groups],
  )

  const value = useMemo<GroupContextValue | null>(() => {
    if (!groups || !slug) return null
    const group = groups.find((candidate) => candidate.slug === slug)
    return group ? { group, groups, setGroup } : null
  }, [groups, slug, setGroup])

  if (!value) {
    return selection.status === 'none' && graceElapsed ? none : pending
  }

  return <GroupContext value={value}>{children}</GroupContext>
}
