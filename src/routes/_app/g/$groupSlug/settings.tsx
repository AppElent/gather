import { createFileRoute } from '@tanstack/react-router'
import { useGroup } from '../../../../components/app/GroupGate'
import { ConnectionsSettings } from '../../../../components/settings/ConnectionsSettings'
import { GroupIdentitySettings } from '../../../../components/settings/GroupIdentitySettings'
import { GroupMembersSettings } from '../../../../components/settings/GroupMembersSettings'
import { fmt, useMessages } from '../../../../lib/i18n'

/**
 * A Group's own settings, as against `/settings`, which is yours.
 *
 * Connections live here rather than on the flat page because a connection
 * belongs to a Group (ADR-0003): the Notion token a household authorised is the
 * household's, and which household is being changed has to be visible in the
 * address rather than inferred from an account default.
 *
 * This is also where a Group row on `/groups` now lands, so it carries the
 * Group's own identity above that — its name, its invite code, and the way out
 * of it. A page called "<Group> settings" that held only somebody else's OAuth
 * tokens read as unfinished, and clicking a Group expecting to reach *it* and
 * arriving at a Notion card would have made that worse.
 */
export const Route = createFileRoute('/_app/g/$groupSlug/settings')({
  component: GroupSettings,
})

function GroupSettings() {
  const { groupSlug } = Route.useParams()
  // The gate has already resolved this Group and refused anyone who is not a
  // Member, so the name is here to be read rather than queried for again.
  const group = useGroup()
  const { groupPage } = useMessages().settings

  return (
    // See `GroupHome` for why the track is `minmax(0,1fr)` and the heading is
    // `wrap-anywhere`: a Group's name is somebody else's input and can be one
    // long word, which an `auto` track would widen the whole page to fit.
    <div className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-4">
      <header>
        <h1 className="m-0 text-xl font-semibold wrap-anywhere">
          {fmt(groupPage.title, { group: group.name })}
        </h1>
        <p className="mt-1 mb-0 text-sm leading-6 text-[var(--app-muted)]">
          {groupPage.intro}
        </p>
      </header>
      <GroupIdentitySettings group={group} />
      <GroupMembersSettings group={group} />
      <ConnectionsSettings groupSlug={groupSlug} groupName={group.name} />
    </div>
  )
}
