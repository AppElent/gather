import type { ComponentType } from 'react'
import type { WidgetInstance } from '../../lib/modules'

export type WidgetRendererRegistry = Record<
  string,
  ComponentType<{ instance: WidgetInstance; spaceSlug: string }>
>

// Module-owned renderers are registered here once their live modules export them.
// No substitute domain widgets belong in the dashboard shell.
export const widgetRenderers: WidgetRendererRegistry = {}
