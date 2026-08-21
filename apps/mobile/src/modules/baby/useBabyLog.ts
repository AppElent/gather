/**
 * Everything a Baby log screen needs about the current Child, in one place.
 *
 * The Group is ambient on the phone (ADR-0015) but every Convex function in
 * this Module still takes a `groupSlug`, because a write happens at the address
 * that names its Group (ADR-0007) — the phone reads that address from the
 * provider instead of from a URL, and nothing else changes.
 *
 * Queries are skipped rather than fired with a placeholder while their input is
 * unknown: firing `listByBaby` with an id that has not resolved makes the
 * access check throw instead of the screen falling through to its empty state.
 */
import { babyBarSlots, trackedEventTypes } from '@gather/core/domain'
import { useQuery } from 'convex/react'
import { useCallback, useMemo, useState } from 'react'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { useGroup } from '../../group/GroupProvider'
import {
  babyChildKey,
  readPreference,
  writePreference,
} from '../../prefs/localPreference'
import { resolveSelectedChild } from './selectedChild'

export function useBabyLog() {
  const { group } = useGroup()
  const groupSlug = group.slug

  const children = useQuery(api.babies.list, { groupSlug })

  // Read once per Group rather than on every render: the store is synchronous,
  // and re-reading would undo a selection the moment anything else re-rendered.
  const [remembered, setRemembered] = useState<string | null>(() =>
    readPreference(babyChildKey(groupSlug)),
  )

  const child = useMemo(
    () => (children ? resolveSelectedChild(children, remembered) : null),
    [children, remembered],
  )

  const selectChild = useCallback(
    (childId: string) => {
      writePreference(babyChildKey(groupSlug), childId)
      setRemembered(childId)
    },
    [groupSlug],
  )

  const events = useQuery(
    api.babyEvents.listByBaby,
    child ? { babyId: child._id as Id<'babies'>, groupSlug } : 'skip',
  )

  const tracked = useMemo(
    () => trackedEventTypes(child?.untrackedTypes),
    [child],
  )

  /** The log bar, reconciled: which types are offered, and where each sits. */
  const slots = useMemo(
    () => babyBarSlots(tracked, child?.barOrder),
    [tracked, child],
  )

  return {
    groupSlug,
    groupName: group.name,
    /** `undefined` while loading, `[]` when this Group has no Child yet. */
    children,
    child,
    selectChild,
    events,
    tracked,
    slots,
    loading: children === undefined,
  }
}
