import { useMutation } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type {
  WidgetDefinition,
  WidgetInstance,
  WidgetSize,
} from '../../lib/modules'
import { WidgetLibrary } from './WidgetLibrary'

const unsafeApi = api as unknown as {
  spacePreferences: { saveDashboard: unknown; resetDashboard: unknown }
  spaces: { saveDefaultDashboard: unknown }
}

function clone(widgets: readonly WidgetInstance[]) {
  return structuredClone(widgets) as WidgetInstance[]
}

function move(
  widgets: WidgetInstance[],
  instanceId: string,
  direction: -1 | 1,
) {
  const index = widgets.findIndex((widget) => widget.instanceId === instanceId)
  const target = index + direction
  if (index < 0 || target < 0 || target >= widgets.length) return widgets
  const next = [...widgets]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export type DashboardEditorMode = 'space' | 'personal'

export function DashboardEditor({
  spaceSlug,
  mode,
  initialWidgets,
  definitions,
  availableRendererIds,
}: {
  spaceSlug: string
  mode: DashboardEditorMode
  initialWidgets: readonly WidgetInstance[]
  definitions: readonly WidgetDefinition[]
  availableRendererIds: readonly string[]
}) {
  const [widgets, setWidgets] = useState(() => clone(initialWidgets))
  useEffect(() => setWidgets(clone(initialWidgets)), [initialWidgets])
  const definitionsById = new Map(
    definitions.map((definition) => [definition.id, definition]),
  )
  const savePersonal = (
    useMutation as unknown as (reference: unknown) => unknown
  )(unsafeApi.spacePreferences.saveDashboard) as (args: {
    spaceSlug: string
    dashboard: WidgetInstance[]
  }) => Promise<unknown>
  const resetPersonal = (
    useMutation as unknown as (reference: unknown) => unknown
  )(unsafeApi.spacePreferences.resetDashboard) as (args: {
    spaceSlug: string
  }) => Promise<unknown>
  const saveDefault = (
    useMutation as unknown as (reference: unknown) => unknown
  )(unsafeApi.spaces.saveDefaultDashboard) as (args: {
    spaceSlug: string
    dashboard: WidgetInstance[]
  }) => Promise<unknown>
  const add = (definition: WidgetDefinition) =>
    setWidgets((current) => [
      ...current,
      {
        instanceId: crypto.randomUUID(),
        widgetDefinitionId: definition.id,
        size: definition.defaultSize,
      },
    ])

  return (
    <section className="grid max-w-4xl gap-6">
      <header>
        <h1 className="m-0 text-2xl font-semibold">
          {mode === 'space' ? 'Space dashboard' : 'My dashboard'}
        </h1>
        <p className="mb-0 mt-1 text-sm text-[var(--app-muted)]">
          Arrange the widgets shown on Home.
        </p>
      </header>
      <section className="grid gap-3" aria-label="Dashboard widgets">
        {widgets.map((widget, index) => {
          const definition = definitionsById.get(widget.widgetDefinitionId)
          return (
            <article
              key={widget.instanceId}
              className="grid gap-3 rounded border border-[var(--app-border)] p-3 md:grid-cols-[1fr_auto_auto_auto_auto] md:items-center"
            >
              <strong>{definition?.label ?? 'Widget unavailable'}</strong>
              <label className="flex items-center gap-2 text-sm">
                Size
                <select
                  aria-label={`${definition?.label ?? 'Widget'} size`}
                  value={widget.size}
                  onChange={(event) =>
                    setWidgets((current) =>
                      current.map((item) =>
                        item.instanceId === widget.instanceId
                          ? { ...item, size: event.target.value as WidgetSize }
                          : item,
                      ),
                    )
                  }
                >
                  {(definition?.allowedSizes ?? [widget.size]).map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                aria-label={`Move ${definition?.label ?? 'widget'} up`}
                disabled={index === 0}
                onClick={() =>
                  setWidgets((current) => move(current, widget.instanceId, -1))
                }
              >
                Move up
              </button>
              <button
                type="button"
                aria-label={`Move ${definition?.label ?? 'widget'} down`}
                disabled={index === widgets.length - 1}
                onClick={() =>
                  setWidgets((current) => move(current, widget.instanceId, 1))
                }
              >
                Move down
              </button>
              <button
                type="button"
                aria-label={`Remove ${definition?.label ?? 'widget'}`}
                onClick={() =>
                  setWidgets((current) =>
                    current.filter(
                      (item) => item.instanceId !== widget.instanceId,
                    ),
                  )
                }
              >
                Remove
              </button>
            </article>
          )
        })}
      </section>
      <WidgetLibrary
        definitions={definitions}
        widgets={widgets}
        availableRendererIds={availableRendererIds}
        onAdd={add}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            void (mode === 'space'
              ? saveDefault({ spaceSlug, dashboard: widgets })
              : savePersonal({ spaceSlug, dashboard: widgets }))
          }
        >
          {mode === 'space' ? 'Save Space dashboard' : 'Save my dashboard'}
        </button>
        <button type="button" onClick={() => setWidgets(clone(initialWidgets))}>
          Cancel
        </button>
        {mode === 'personal' ? (
          <button
            type="button"
            onClick={() => void resetPersonal({ spaceSlug })}
          >
            Use Space default
          </button>
        ) : null}
      </div>
    </section>
  )
}
