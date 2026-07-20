import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { DashboardEditor } from '../../../../../components/dashboard/DashboardEditor'
import { widgetRenderers } from '../../../../../components/dashboard/widgetRenderers'
import { useSpaceModules } from '../../../../../components/spaces/SpaceContext'

export const Route = createFileRoute('/_app/s/$spaceSlug/settings/dashboard')({
  component: DashboardSettings,
})

function DashboardSettings() {
  const { space, role, dashboard, visibleModules } = useSpaceModules()
  const [mode, setMode] = useState<'space' | 'personal'>('space')
  const editorMode = role === 'admin' ? mode : 'personal'
  const definitions = visibleModules.flatMap((module) => module.widgets)
  const initialWidgets =
    editorMode === 'space'
      ? (dashboard.spaceDefaultDashboard ?? dashboard.widgets)
      : (dashboard.personalDashboard ?? dashboard.widgets)

  return (
    <section className="grid gap-4">
      {role === 'admin' ? (
        <nav
          className="flex flex-wrap gap-2"
          aria-label="Dashboard editor mode"
        >
          <button
            type="button"
            aria-pressed={mode === 'space'}
            onClick={() => setMode('space')}
          >
            Space dashboard
          </button>
          <button
            type="button"
            aria-pressed={mode === 'personal'}
            onClick={() => setMode('personal')}
          >
            My dashboard
          </button>
        </nav>
      ) : null}
      <DashboardEditor
        spaceSlug={space.slug}
        mode={editorMode}
        initialWidgets={initialWidgets}
        definitions={definitions}
        availableRendererIds={Object.keys(widgetRenderers)}
      />
    </section>
  )
}
