import type { ModuleDefinition, SpaceModuleState } from './modules'

export interface SpaceModuleRecord {
  moduleId: string
  state: SpaceModuleState
}

export function isModuleVisible(
  definition: ModuleDefinition,
  state: SpaceModuleState | undefined,
) {
  return (
    definition.availability === 'live' &&
    (state === 'enabled' || state === 'preEnabled')
  )
}

export function createNewSpaceModuleStates(
  catalog: readonly ModuleDefinition[],
): SpaceModuleRecord[] {
  return catalog
    .filter((module) => module.defaultForNewSpaces)
    .map((module) => ({
      moduleId: module.id,
      state: module.availability === 'live' ? 'enabled' : 'preEnabled',
    }))
}

export function getVisibleModuleIds(
  catalog: readonly ModuleDefinition[],
  states: readonly SpaceModuleRecord[],
): string[] {
  const stateByModule = new Map(
    states.map((state) => [state.moduleId, state.state]),
  )
  return catalog
    .filter((definition) =>
      isModuleVisible(definition, stateByModule.get(definition.id)),
    )
    .map((definition) => definition.id)
}
