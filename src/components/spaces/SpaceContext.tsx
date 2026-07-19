import { createContext, useContext } from 'react'
import {
  MODULES,
  type ModuleDef,
  type SpaceModuleState,
} from '../../lib/modules'
import { getVisibleModuleIds } from '../../lib/spaceModules'

export type SpaceContextValue = {
  space: { slug: string; name?: string; clerkOrganizationId?: string }
  user: { name: string }
  role: 'admin' | 'member'
  modules: readonly { moduleId: string; state: SpaceModuleState }[]
  navigation: { pinnedModuleIds: readonly string[] }
  dashboard: { widgets: readonly unknown[] }
}

const SpaceContext = createContext<SpaceContextValue | null>(null)

export function SpaceContextProvider({
  value,
  children,
}: {
  value: SpaceContextValue
  children: React.ReactNode
}) {
  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>
}

export function useSpace() {
  const value = useContext(SpaceContext)
  if (!value)
    throw new Error('useSpace must be used inside a ready SpaceRouteGate')
  return value
}

export function useSpaceModules() {
  const context = useSpace()
  const visibleModuleIds = getVisibleModuleIds(MODULES, context.modules)
  const visibleModules = visibleModuleIds
    .map((moduleId) => MODULES.find((module) => module.id === moduleId))
    .filter((module): module is ModuleDef => module !== undefined)
  const visibleModuleIdSet = new Set(visibleModuleIds)
  const pinnedModuleIds = context.navigation.pinnedModuleIds.filter(
    (moduleId) => visibleModuleIdSet.has(moduleId),
  )
  const pinnedModules = pinnedModuleIds
    .map((moduleId) => visibleModules.find((module) => module.id === moduleId))
    .filter((module): module is ModuleDef => module !== undefined)

  return { ...context, visibleModules, pinnedModules }
}
