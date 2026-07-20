import { createFileRoute, Link } from '@tanstack/react-router'
import { SpaceSettings } from '../../../../../components/settings/SpaceSettings'

export const Route = createFileRoute('/_app/s/$spaceSlug/settings/')({
  component: SettingsIndex,
})

function SettingsIndex() {
  const { spaceSlug } = Route.useParams()
  return (
    <div className="grid gap-6">
      <nav className="flex flex-wrap gap-3" aria-label="Space settings">
        <Link to="/s/$spaceSlug/settings/modules" params={{ spaceSlug }}>
          Modules
        </Link>
        <Link to="/s/$spaceSlug/settings/navigation" params={{ spaceSlug }}>
          Navigation
        </Link>
      </nav>
      <SpaceSettings />
    </div>
  )
}
