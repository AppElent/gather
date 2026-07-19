import { createContext, useContext } from 'react'

export type SpaceContextValue = {
  space: { slug: string }
  user: { name: string }
  role: 'admin' | 'member'
  modules: readonly unknown[]
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
