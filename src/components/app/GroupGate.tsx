import { useQuery } from 'convex/react'
import { createContext, type ReactNode, useContext, useMemo } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

/**
 * The Group a `/g/<slug>/…` page is being viewed in.
 *
 * Everything here is derived from the route params on every render. Nothing is
 * cached in a module-level variable or a store, which is precisely what lets two
 * browser tabs sit in two different Groups: the only place the answer lives is
 * the URL each tab happens to be on.
 */
export interface ActiveGroup {
  _id: Id<'groups'>
  name: string
  slug: string
  isPersonal: boolean
  /** The viewer's own standing in this Group. */
  role: 'admin' | 'member'
}

const GroupContext = createContext<ActiveGroup | null>(null)

/**
 * The Group the current route is in. Throws outside the gate rather than
 * returning null, because a Group-scoped page that renders without a resolved
 * Group is a routing bug, not a state to handle.
 */
export function useGroup(): ActiveGroup {
  const group = useContext(GroupContext)
  if (!group) {
    throw new Error('useGroup must be used inside a /g/<slug> route')
  }
  return group
}

function GateMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto grid max-w-md justify-items-center gap-2 py-16 text-center">
      <h1 className="m-0 text-lg font-semibold text-[var(--app-fg)]">
        {title}
      </h1>
      <p className="m-0 text-sm text-[var(--app-muted)]">{body}</p>
    </div>
  )
}

export interface GroupGateProps {
  slug: string
  children: ReactNode
}

/**
 * The single membership check for every Group-scoped page.
 *
 * Four states, and no fifth: still asking, no such Group, not yours, or the
 * page. "No such Group" and "not yours" are kept apart all the way from
 * `groups.bySlug` — a typo and a refusal are different things, and neither is a
 * blank page or a crash.
 *
 * There is deliberately no redirect on refusal. Bouncing someone to a Group
 * they *are* in would make the URL stop meaning what it says, which is the
 * whole point of ADR-0002.
 */
export function GroupGate({ slug, children }: GroupGateProps) {
  const result = useQuery(api.groups.bySlug, { slug })

  const group = useMemo<ActiveGroup | null>(
    () => (result?.ok ? { ...result.group, role: result.role } : null),
    [result],
  )

  if (result === undefined) {
    return (
      <p className="py-16 text-center text-sm text-[var(--app-muted)]">
        Loading…
      </p>
    )
  }

  if (!result.ok) {
    if (result.reason === 'unknown-slug') {
      return (
        <GateMessage
          title="No such group"
          body={`Nothing here is called “${slug}”. Check the link, or pick a group from the sidebar.`}
        />
      )
    }

    // 'not-a-member' and 'not-signed-in' land here together. Under the app
    // layout the session is already established, so a missing identity means it
    // went away mid-visit — either way the honest answer is the same: this
    // group is not yours to see.
    return (
      <GateMessage
        title="This group is not yours"
        body="You are not a member of it. Ask an admin of the group for an invite."
      />
    )
  }

  return <GroupContext.Provider value={group}>{children}</GroupContext.Provider>
}
