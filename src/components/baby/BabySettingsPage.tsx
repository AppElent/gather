import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { fmt, useMessages } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { EmptyState } from '../app/EmptyState'
import { InsetRow } from '../app/InsetList'
import { ListLoadingState } from '../app/ListDetailLayout'
import { ModuleSettingsGroup, ModuleSettingsPage } from '../app/ModuleSettingsPage'
import { ModuleTile } from '../app/ModuleTile'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'

/**
 * Baby log settings: the Group's children, each opening its own edit page.
 * What Baby log has to configure belongs to a Child (ADR-0022), so the
 * Module's page is this list.
 */
export function BabySettingsPage() {
  const group = useRequiredCurrentGroup()
  const babies = useQuery(api.babies.list, { groupSlug: group.slug })
  const messages = useMessages()
  const { list } = messages.baby.log
  const label = messages.modules.byId['baby-log'].label

  return (
    <ModuleSettingsPage moduleId="baby-log">
      {babies === undefined ? (
        <ListLoadingState label={messages.common.errors.loading} sections={1} />
      ) : babies.length === 0 ? (
        <EmptyState
          kind="nothing-yet"
          title={list.emptyTitle}
          body={list.emptyBody}
          tile={{ group: 'home', icon: 'Baby' }}
          action={{ label: list.emptyAction, link: linkTo('newChild') }}
        />
      ) : (
        <ModuleSettingsGroup
          label={label}
          footer={fmt(messages.shell.modulePage.settingsShared, {
            group: group.name,
          })}
        >
          {babies.map((baby) => (
            <InsetRow
              key={baby._id}
              title={baby.name}
              leading={
                baby.photoUrl ? (
                  <img
                    src={baby.photoUrl}
                    alt=""
                    className="size-7 rounded-full object-cover"
                  />
                ) : (
                  <ModuleTile group="home" icon="Baby" />
                )
              }
              link={linkTo('editChild', { babyId: baby._id })}
            />
          ))}
        </ModuleSettingsGroup>
      )}
    </ModuleSettingsPage>
  )
}
