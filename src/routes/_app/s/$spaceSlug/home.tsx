import { createFileRoute, Link } from '@tanstack/react-router'
import {
  getEffectiveWidgetInstances,
  WidgetDashboard,
} from '../../../../components/dashboard/WidgetDashboard'
import { useSpaceModules } from '../../../../components/spaces/SpaceContext'

export const Route = createFileRoute('/_app/s/$spaceSlug/home')({
  component: SpaceHome,
})

function EmptyDashboardState({
  role,
  spaceSlug,
}: {
  role: 'admin' | 'member'
  spaceSlug: string
}) {
  return (
    <section className="grid gap-3 rounded-[var(--app-radius)] border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-sm text-[var(--app-muted)]">
      <div>
        <h2 className="m-0 text-base font-semibold text-[var(--app-text)]">
          No dashboard widgets yet.
        </h2>
        <p className="mb-0 mt-1">
          {role === 'admin'
            ? 'Enable a live module, then choose the default widgets for this Space.'
            : 'Add widgets to make this Home view your own.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {role === 'admin' ? (
          <Link to="/s/$spaceSlug/settings/modules" params={{ spaceSlug }}>
            Manage modules
          </Link>
        ) : null}
        <Link to="/s/$spaceSlug/settings/dashboard" params={{ spaceSlug }}>
          {role === 'admin' ? 'Edit Space dashboard' : 'Add widgets'}
        </Link>
      </div>
    </section>
  )
}

export function SpaceHome() {
  const { space, role, dashboard, visibleModules } = useSpaceModules()
  const visibleModuleIds = visibleModules.map((module) => module.id)
  const effectiveWidgets = getEffectiveWidgetInstances(
    dashboard.widgets,
    visibleModuleIds,
  )
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header>
        <h1 className="m-0 text-2xl font-semibold">
          {space.name ?? space.slug}
        </h1>
        <p className="mb-0 mt-2 text-sm text-[var(--app-muted)]">
          Your Space dashboard.
        </p>
      </header>
      {effectiveWidgets.length === 0 ? (
        <EmptyDashboardState role={role} spaceSlug={space.slug} />
      ) : (
        <WidgetDashboard
          spaceSlug={space.slug}
          widgets={dashboard.widgets}
          visibleModuleIds={visibleModuleIds}
        />
      )}
    </div>
  )
}
