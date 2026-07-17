export type NavigationDestination = 'home' | 'modules' | string

export function resolvePinnedModuleIds(
  shared: readonly string[],
  personal?: readonly string[],
) {
  return [...(personal === undefined ? shared : personal)]
}

export function buildMobileDock(pins: readonly string[]) {
  return ['home', ...pins.slice(0, 3), 'modules'] as const
}

export function buildDesktopNavigation(pins: readonly string[]) {
  return ['home', ...pins, 'modules'] as const
}

export function orderAllModules(
  visibleModuleIds: readonly string[],
  pinnedModuleIds: readonly string[],
) {
  const visible = new Set(visibleModuleIds)
  const ordered: string[] = []
  const pinned = new Set<string>()

  for (const moduleId of pinnedModuleIds) {
    if (!visible.has(moduleId) || pinned.has(moduleId)) continue
    ordered.push(moduleId)
    pinned.add(moduleId)
  }

  return [
    ...ordered,
    ...visibleModuleIds.filter((moduleId) => !pinned.has(moduleId)),
  ]
}
