import { selectGroup } from '@gather/core/groups'
import { useQuery } from 'convex/react'
import {
  createContext,
  createElement,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

const STORAGE_KEY = 'gather:current-group'

/** A Group as the shell needs it: enough to name, select, and scope it. */
export interface ShellGroup {
  _id: Id<'groups'>
  name: string
  slug: string
  icon?: string
  imageId?: Id<'_storage'>
  imageUrl?: string | null
  role: 'admin' | 'member'
}

interface CurrentGroupValue {
  current: ShellGroup | null
  groups: ShellGroup[] | undefined
  setCurrentGroup: (groupId: string) => void
}

const CurrentGroupContext = createContext<CurrentGroupValue | null>(null)

function readRetainedGroup(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(STORAGE_KEY)
}

/**
 * The client's Current Group. It is local state validated against membership,
 * never an address-bar parameter or a server-side default.
 */
export function CurrentGroupProvider({ children }: { children: ReactNode }) {
  const [retained, setRetained] = useState(readRetainedGroup)
  const groups = useQuery(api.groups.myGroups) as ShellGroup[] | undefined
  const selection = selectGroup(retained, groups)
  const groupId = selection.status === 'ready' ? selection.groupId : null

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (groupId) window.localStorage.setItem(STORAGE_KEY, groupId)
    else if (selection.status === 'none') window.localStorage.removeItem(STORAGE_KEY)
  }, [groupId, selection.status])

  if (groupId !== null && groupId !== retained) setRetained(groupId)

  const setCurrentGroup = useCallback((next: string) => {
    // Create and join return a membership-bearing id before the reactive list
    // has had a chance to refresh. Retain it immediately; selection validates
    // it on the next render and falls back safely if it does not materialize.
    setRetained(next)
  }, [])

  const value = useMemo<CurrentGroupValue>(
    () => ({
      current: groups?.find((group) => group._id === groupId) ?? null,
      groups,
      setCurrentGroup,
    }),
    [groupId, groups, setCurrentGroup],
  )

  return createElement(CurrentGroupContext, { value }, children)
}

export function useCurrentGroup(): CurrentGroupValue {
  const value = use(CurrentGroupContext)
  if (!value) throw new Error('useCurrentGroup must be used in CurrentGroupProvider')
  return value
}

/** A Group-scoped page cannot render without a resolved ambient Group. */
export function useRequiredCurrentGroup(): ShellGroup {
  const { current } = useCurrentGroup()
  if (!current) throw new Error('A Group-scoped page requires a Current Group')
  return current
}
