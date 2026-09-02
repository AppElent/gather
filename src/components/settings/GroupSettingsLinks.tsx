import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { groupLink } from '../../lib/groupPaths'
import { useMessages } from '../../lib/i18n'
import { SurfaceCard } from '../app/ShellPrimitives'
import { useCurrentGroup } from '../app/useCurrentGroup'

/**
 * Where the connections went.
 *
 * Connecting Notion or Todoist used to be a row on this page, which read as a
 * setting about you; it is a setting about a Group, and now lives on each
 * Group's own settings page. Somebody who knows where it was should find it
 * rather than find it missing — so this says which Groups there are and links
 * to each one, instead of the section simply vanishing.
 */
export function GroupSettingsLinks() {
  const groups = useQuery(api.groups.myGroups)
  const messages = useMessages()
  const { groupSettings } = messages.settings
  const { setCurrentGroup } = useCurrentGroup()

  return (
    <SurfaceCard>
      <h2 className="m-0 mb-1 text-base font-semibold">
        {groupSettings.title}
      </h2>
      <p className="m-0 mb-3 text-sm text-[var(--app-muted)]">
        {groupSettings.description}
      </p>
      {groups === undefined ? (
        <p className="m-0 text-sm text-[var(--app-muted)]">
          {messages.common.errors.loading}
        </p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {groups.map((group) => (
            <li key={group._id}>
              <Link
                {...groupLink('settings', group.slug)}
                onClick={() => setCurrentGroup(group._id)}
                className="flex min-h-9 items-center justify-between gap-3 rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 py-2 text-sm font-semibold no-underline"
              >
                {group.name}
                <span className="text-xs font-normal text-[var(--app-muted)]">
                  {groupSettings.open}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SurfaceCard>
  )
}
