import type { WidgetDefinition, WidgetInstance } from '../../lib/modules'

export function WidgetLibrary({
  definitions,
  widgets,
  availableRendererIds,
  onAdd,
}: {
  definitions: readonly WidgetDefinition[]
  widgets: readonly WidgetInstance[]
  availableRendererIds: readonly string[]
  onAdd: (definition: WidgetDefinition) => void
}) {
  const rendererIds = new Set(availableRendererIds)
  return (
    <section className="grid gap-3" aria-label="Widget library">
      <h2 className="m-0 text-lg font-semibold">Add widgets</h2>
      {definitions
        .filter((definition) => rendererIds.has(definition.id))
        .map((definition) => {
          const alreadyAdded = widgets.some(
            (widget) => widget.widgetDefinitionId === definition.id,
          )
          return (
            <div
              key={definition.id}
              className="flex items-center gap-3 rounded border border-[var(--app-border)] p-3"
            >
              <span className="mr-auto text-sm font-medium">
                {definition.label}
              </span>
              <button
                type="button"
                disabled={!definition.allowMultiple && alreadyAdded}
                onClick={() => onAdd(definition)}
              >
                Add {definition.label}
              </button>
            </div>
          )
        })}
    </section>
  )
}
