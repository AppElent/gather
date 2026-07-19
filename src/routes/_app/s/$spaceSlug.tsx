import { createFileRoute, Outlet } from '@tanstack/react-router'
import { AppShell } from '../../../components/app/AppShell'
import { SpaceRouteGate } from '../../../components/spaces/SpaceRouteGate'

export const Route = createFileRoute('/_app/s/$spaceSlug')({
  component: SpaceLayout,
})
function SpaceLayout() {
  const { spaceSlug } = Route.useParams()
  return (
    <SpaceRouteGate spaceSlug={spaceSlug}>
      <AppShell>
        <Outlet />
      </AppShell>
    </SpaceRouteGate>
  )
}
