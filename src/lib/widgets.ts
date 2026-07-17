import type { WidgetDefinition, WidgetInstance } from './modules'

export type { WidgetDefinition, WidgetInstance, WidgetSize } from './modules'

export function resolveDashboard(
  shared: readonly WidgetInstance[],
  personal?: readonly WidgetInstance[],
) {
  return structuredClone(personal === undefined ? shared : personal)
}

export function validateWidgetInstances(
  instances: readonly WidgetInstance[],
  definitions: readonly WidgetDefinition[],
) {
  const definitionsById = new Map(
    definitions.map((definition) => [definition.id, definition]),
  )
  const counts = new Map<string, number>()

  for (const instance of instances) {
    const definition = definitionsById.get(instance.widgetDefinitionId)
    if (!definition) {
      throw new Error(`Unknown widget ${instance.widgetDefinitionId}`)
    }
    if (!definition.allowedSizes.includes(instance.size)) {
      throw new Error(`${definition.id} does not support ${instance.size}`)
    }

    const count = (counts.get(definition.id) ?? 0) + 1
    counts.set(definition.id, count)
    if (!definition.allowMultiple && count > 1) {
      throw new Error(`${definition.id} can only appear once`)
    }
  }

  return structuredClone(instances)
}
