/**
 * The Group you are in, which on a phone is a place rather than an address.
 *
 * The Current Group is ambient (ADR-0031): it lives in this context, is
 * retained locally between launches, and is **validated against
 * `groups.myGroups` on every read**. Being removed from a Group is a real
 * event; a retained id is a guess about a membership that may have ended while
 * the app was closed.
 *
 * A Group is named by its id here and everywhere the app chooses one. A slug
 * is only what the backend's queries still take and what an old `/g/<slug>`
 * link carries; those resolve it to an id through `groups` first.
 *
 * The decision itself is `selectGroup` in `@gather/core/groups` — pure, shared
 * with the web, and tested in the Node seam. What is left here is the three
 * things only a client can do: read the retained id, persist a new one, and
 * decide what to draw while the answer is not `ready`.
 *
 * Three states, and no fourth:
 *
 * - **pending** — the Groups have not arrived. Nothing Group-scoped can render.
 * - **none** — the Member really is in no Group.
 * - **ready** — `useGroup()` answers, and every surface under it can rely on it.
 */
import { useAuth } from '@clerk/expo'
import { selectGroup } from '@gather/core/groups'
import { useConvexAuth } from 'convex/react'
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
import { api, type Id } from '../convex/api'
import { useQuery } from '../convex/queries'
import {
  groupsForSurface,
  type RetainedGroups,
  retainGroups,
} from './groupsForSurface'
import {
  clearRetainedGroup,
  readRetainedGroup,
  writeRetainedGroup,
} from './retainedGroup'

/** A Group as the phone needs it: enough to name it, switch to it, and scope a
 * query by it. */
export interface AmbientGroup {
  _id: Id<'groups'>
  name: string
  slug: string
}

export interface GroupContextValue {
  /** The Group everything on screen is in. */
  group: AmbientGroup
  /** Every Group this Member is in, in the order the backend returns them. */
  groups: AmbientGroup[]
  /**
   * Move to another Group, named by its id — a slug does not typecheck. Ignores
   * an id the Member is not in, because the only way to obtain one is a stale
   * list, and honouring it would put the app in a Group the backend then
   * refuses every query for.
   *
   * ADR-0015 also requires a switch to unwind every tab stack. That is not
   * done here, because this provider sits above the navigator: any change of
   * the Group on screen calls `onSwitch`, and the shell resets the stacks
   * (`groupUnwind.ts`).
   */
  setGroup: (groupId: Id<'groups'>) => void
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
  /**
   * Called whenever the Group on screen changes to another one — a switch, or
   * the fallback when a membership ends under the app — and never for the
   * first Group after sign-in. It runs before paint, while every `GroupScoped`
   * screen is drawing nothing, so a screen left over from the old Group never
   * renders inside the new one.
   */
  onSwitch?: () => void
}

export function GroupProvider({
  children,
  pending,
  none,
  onSwitch,
}: GroupProviderProps) {
  // Read once, synchronously, before the first paint. An awaited read would
  // mean a frame in the wrong Group on every cold start.
  const [retained, setRetained] = useState(readRetainedGroup)

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
      myGroups?.map(({ _id, name, slug }) => ({
        _id,
        name,
        slug,
      })),
    [myGroups],
  )
  // Convex removes a query result while its auth token or socket is being
  // recovered. Keep the last resolved list so an in-shell connection loss
  // preserves the Group name and orientation instead of replacing the shell
  // with a loading gate — but only for the account it was resolved for. A
  // sign-out or account switch drops it, so the previous account's Group can
  // never stay on screen for the next one.
  const { userId } = useAuth()
  const [lastGroups, setLastGroups] = useState<
    RetainedGroups<AmbientGroup> | undefined
  >()
  const nextRetained = retainGroups(lastGroups, groups, userId)
  if (nextRetained !== lastGroups) setLastGroups(nextRetained)
  const visibleGroups = groupsForSurface(groups, nextRetained, userId)

  const selection = selectGroup(retained, visibleGroups)

  useEffect(() => {
    if (selection.status === 'none') clearRetainedGroup()
  }, [selection.status])

  const groupId = selection.status === 'ready' ? selection.groupId : null

  // A fallback replaces what was retained, in memory as well as on disk. Not
  // doing so leaves an id that is not where anybody is: a Member removed from
  // the Group they left the app in would be bounced off it again on every
  // launch, and — worse — being *re-added* to it later in the same session
  // would make the stale id match again and silently yank them out of the
  // Group they were reading.
  //
  // Adjusting state during render rather than in an effect is React's own
  // pattern for this, and it converges in one pass: an id that resolves to
  // itself produces no further update.
  if (groupId !== null && groupId !== retained) setRetained(groupId)

  useEffect(() => {
    if (groupId) writeRetainedGroup(groupId)
  }, [groupId])

  const setGroup = useCallback(
    (next: Id<'groups'>) => {
      if (!visibleGroups?.some((candidate) => candidate._id === next)) return
      setRetained(next)
    },
    [visibleGroups],
  )

  const resolved =
    visibleGroups?.find((candidate) => candidate._id === groupId) ?? null

  // The Group the tab stacks were last unwound for. Both ways the Group
  // changes — `setGroup`, and the fallback above when `groups.myGroups` drops
  // the one on screen — leave it behind `resolved` for exactly one render,
  // and that render is the dangerous one: whatever is pushed in a stack still
  // belongs to the old Group, and when a membership ended its queries are
  // already failing in the same update that dropped the Group. So for that
  // render every Group-scoped screen draws nothing (`GroupScoped`), and the
  // layout effect below unwinds the stacks and catches up before anything is
  // painted. The native stacks stay mounted throughout (#235); only the
  // screens' contents are let go, which is what the old Group `key` did.
  //
  // The first Group after sign-in is taken during render: there are no stacks
  // to unwind. Losing the answer (sign-out, leaving the last Group) unmounts
  // the tree, so the next one is a first Group again.
  const [unwoundFor, setUnwoundFor] = useState<string | null>(null)
  if (unwoundFor === null && resolved !== null) setUnwoundFor(resolved._id)
  if (unwoundFor !== null && resolved === null) setUnwoundFor(null)
  const unwinding =
    resolved !== null && unwoundFor !== null && unwoundFor !== resolved._id

  useLayoutEffect(() => {
    if (!unwinding || !resolved) return
    onSwitch?.()
    // A layout effect's update is flushed before paint, which is the point:
    // the navigator cannot be dispatched to during this component's render.
    setUnwoundFor(resolved._id)
  }, [unwinding, resolved, onSwitch])

  const value = useMemo<GroupContextValue | null>(() => {
    if (!visibleGroups || !resolved) return null
    return { group: resolved, groups: visibleGroups, setGroup }
  }, [visibleGroups, resolved, setGroup])

  if (!value) {
    return selection.status === 'none' ? none : pending
  }

  return (
    <GroupContext value={value}>
      <UnwindingContext value={unwinding}>{children}</UnwindingContext>
    </GroupContext>
  )
}

/**
 * Open something in a Group that may not be the one on screen: switch to it,
 * and call `open` once it is the Group on screen.
 *
 * Navigating in the same tick as `setGroup` loses the destination. The switch
 * lands on the next render, and `onSwitch` then unwinds every Group-scoped
 * stack from a navigation state that already holds the screen just pushed. By
 * the time this effect sees the new Group, that unwind has run (a layout
 * effect, flushed before passive ones), so what `open` pushes stays.
 *
 * The caller must stay mounted across the switch, so it cannot be a
 * Group-scoped screen: the Group-link handoff and the Drop screens, which sit
 * above the tabs.
 */
export function useOpenInGroup() {
  const { group, setGroup } = useGroup()
  const [pending, setPending] = useState<{
    groupId: Id<'groups'>
    open: () => void
  } | null>(null)

  useEffect(() => {
    if (!pending) return
    if (pending.groupId !== group._id) {
      setGroup(pending.groupId)
      return
    }
    setPending(null)
    pending.open()
  }, [pending, group._id, setGroup])

  return useCallback(
    (groupId: Id<'groups'>, open: () => void) => setPending({ groupId, open }),
    [],
  )
}

const UnwindingContext = createContext(false)

/**
 * Draws a Group-scoped screen, except during the one render in which the
 * Group has changed and its stack has not yet been unwound (see
 * `unwoundFor`). `GroupScopedStack` wraps every screen of the Home, All and
 * Search stacks in it.
 */
export function GroupScoped({ children }: { children: ReactNode }) {
  return use(UnwindingContext) ? null : children
}
