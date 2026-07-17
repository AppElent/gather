import { MODULES } from '../../src/lib/modules'
import { createNewSpaceModuleStates } from '../../src/lib/spaceModules'
import type { WidgetInstance } from '../../src/lib/widgets'

export function createNewSpaceDefaults(): {
  moduleStates: ReturnType<typeof createNewSpaceModuleStates>
  pinnedModuleIds: string[]
  dashboard: WidgetInstance[]
} {
  const moduleStates = createNewSpaceModuleStates(MODULES)
  const defaultModules = MODULES.filter((module) => module.defaultForNewSpaces)
  return {
    moduleStates,
    pinnedModuleIds: defaultModules.map((module) => module.id),
    dashboard: defaultModules.flatMap((module) =>
      module.defaultWidgetIds.map((widgetDefinitionId) => {
        const definition = module.widgets.find(
          (widget) => widget.id === widgetDefinitionId,
        )
        return {
          instanceId: `default:${widgetDefinitionId}`,
          widgetDefinitionId,
          size: definition?.defaultSize ?? 'standard',
        }
      }),
    ),
  }
}
