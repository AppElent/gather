import { createFileRoute, Outlet } from '@tanstack/react-router'
import { GroupGate } from '../../../components/app/GroupGate'

/**
 * The Group boundary in the URL (ADR-0002).
 *
 * Every Group-scoped page hangs off this route, so membership is checked once,
 * here, from the slug in the address bar — never re-derived per query from a
 * stored default. The gate itself is a component so that its four states can be
 * exercised without a router.
 */
export const Route = createFileRoute('/_app/g/$groupSlug')({
  component: GroupLayout,
})

function GroupLayout() {
  const { groupSlug } = Route.useParams()

  return (
    <GroupGate slug={groupSlug}>
      <Outlet />
    </GroupGate>
  )
}
