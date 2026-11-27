import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useMessages } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { InsetList, InsetRow, SectionFooter, SectionLabel } from '../app/InsetList'
import { useCurrentGroup } from '../app/useCurrentGroup'

/**
 * A way from your settings to each of your Groups' settings, where settings
 * about a Group — such as its Notion and Todoist connections — live.
 *
 * A row's click handler makes that Group the Current Group; its link only
 * says which page to open.
 */
export function GroupSettingsLinks() {
  const groups = useQuery(api.groups.myGroups)
  const messages = useMessages()
  const { groupSettings } = messages.settings
  const { setCurrentGroup } = useCurrentGroup()

  return (
    <section aria-labelledby="group-settings-heading">
      <SectionLabel id="group-settings-heading">
        {groupSettings.title}
      </SectionLabel>
      {groups === undefined ? (
        <p className="m-0 rounded-[var(--radius-card)] bg-[var(--surface)] px-4 py-3.5 text-subhead text-[var(--muted)]">
          {messages.common.errors.loading}
        </p>
      ) : (
        <InsetList>
          {groups.map((group) => (
            <InsetRow
              key={group._id}
              title={group.name}
              link={linkTo('groupSettings')}
              onLinkClick={() => setCurrentGroup(group._id)}
              trailing={<span className="text-footnote">{groupSettings.open}</span>}
            />
          ))}
        </InsetList>
      )}
      <SectionFooter>{groupSettings.description}</SectionFooter>
    </section>
  )
}
