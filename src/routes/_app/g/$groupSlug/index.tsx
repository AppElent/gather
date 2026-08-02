import { createFileRoute } from '@tanstack/react-router'
import { useGroup } from '../../../../components/app/GroupGate'
import { GroupHome } from '../../../../components/home/GroupHome'

/**
 * A Group's Home — what a Member sees on opening it (CONTEXT.md).
 *
 * The route does nothing but hand the Group over. The gate above it has
 * already resolved the slug and refused anyone who is not a Member, so the name
 * is read from there rather than queried for a second time.
 */
export const Route = createFileRoute('/_app/g/$groupSlug/')({
  component: GroupHomeRoute,
})

function GroupHomeRoute() {
  const group = useGroup()

  return (
    <GroupHome
      groupSlug={group.slug}
      groupName={group.name}
      isPersonal={group.isPersonal}
    />
  )
}
