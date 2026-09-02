import type { ReactNode } from 'react'
import { type ShellGroup, useCurrentGroup } from './useCurrentGroup'

/**
 * The shell always reflects the ambient Current Group, including on account
 * and Group-management pages.
 */
export function ShellGroupProvider({ children }: { children: ReactNode }) {
  return children
}

export interface ShellGroupState {
  group: ShellGroup | null
  slug: string | null
  groups: ShellGroup[] | undefined
  addressed: boolean
}

export function useShellGroup(): ShellGroupState {
  const { current, groups } = useCurrentGroup()
  return {
    group: current,
    slug: current?.slug ?? null,
    groups,
    addressed: current !== null,
  }
}
