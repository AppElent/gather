import { WIDGETS, type WidgetInstance } from '../../lib/modules'
import { WidgetErrorBoundary } from './WidgetErrorBoundary'
import { WidgetFrame } from './WidgetFrame'
import { type WidgetRendererRegistry, widgetRenderers } from './widgetRenderers'

export type { WidgetRendererRegistry } from './widgetRenderers'

export function getEffectiveWidgetInstances(
  widgets: readonly WidgetInstance[],
  visibleModuleIds: readonly string[],
) {
  const visible = new Set(visibleModuleIds)
  return widgets.filter((instance) => {
    const definition = WIDGETS.find(
      (widget) => widget.id === instance.widgetDefinitionId,
    )
    return !definition || visible.has(definition.moduleId)
  })
}
export function WidgetDashboard({
  spaceSlug,
  widgets,
  visibleModuleIds,
  renderers = widgetRenderers,
  editMode = false,
  onRemove,
}: {
  spaceSlug: string
  widgets: readonly WidgetInstance[]
  visibleModuleIds: readonly string[]
  renderers?: WidgetRendererRegistry
  editMode?: boolean
  onRemove?: (instanceId: string) => void
}) {
  const effectiveWidgets = getEffectiveWidgetInstances(
    widgets,
    visibleModuleIds,
  )

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {effectiveWidgets.map((instance) => {
        const definition = WIDGETS.find(
          (widget) => widget.id === instance.widgetDefinitionId,
        )
        const Renderer = renderers[instance.widgetDefinitionId]
        const label = definition?.label ?? 'Widget unavailable'
        if (!Renderer) {
          return (
            <WidgetFrame
              key={instance.instanceId}
              instance={instance}
              label={label}
              editMode={editMode}
              onRemove={onRemove}
            >
              <p className="m-0 text-sm text-[var(--app-muted)]">
                Widget unavailable
              </p>
            </WidgetFrame>
          )
        }

        return (
          <WidgetErrorBoundary
            key={instance.instanceId}
            fallback={(retry) => (
              <WidgetFrame
                instance={instance}
                label={label}
                editMode={editMode}
                onRemove={onRemove}
              >
                <p className="m-0 text-sm text-[var(--app-muted)]">
                  This widget could not load
                </p>
                <button type="button" aria-label="Retry widget" onClick={retry}>
                  Retry
                </button>
              </WidgetFrame>
            )}
          >
            <WidgetFrame
              instance={instance}
              label={label}
              editMode={editMode}
              onRemove={onRemove}
            >
              <Renderer instance={instance} spaceSlug={spaceSlug} />
            </WidgetFrame>
          </WidgetErrorBoundary>
        )
      })}
    </div>
  )
}
