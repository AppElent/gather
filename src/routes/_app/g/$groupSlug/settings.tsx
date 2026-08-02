import { createFileRoute } from '@tanstack/react-router'
import { useGroup } from '../../../../components/app/GroupGate'
import { ConnectionsSettings } from '../../../../components/settings/ConnectionsSettings'

/**
 * A Group's own settings, as against `/settings`, which is yours.
 *
 * Connections live here rather than on the flat page because a connection
 * belongs to a Group (ADR-0003): the Notion token a household authorised is the
 * household's, and which household is being changed has to be visible in the
 * address rather than inferred from an account default.
 */
export const Route = createFileRoute('/_app/g/$groupSlug/settings')({
  component: GroupSettings,
})

function GroupSettings() {
  const { groupSlug } = Route.useParams()
  // The gate has already resolved this Group and refused anyone who is not a
  // Member, so the name is here to be read rather than queried for again.
  const group = useGroup()

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <header>
        <h1 className="m-0 text-xl font-semibold">{group.name} settings</h1>
        <p className="mt-1 mb-0 text-sm leading-6 text-[var(--app-muted)]">
          Settings shared by everyone in this group. Your own appearance and
          account settings are in Settings, and are the same in every group.
        </p>
      </header>
      <ConnectionsSettings groupSlug={groupSlug} groupName={group.name} />
    </div>
  )
}
