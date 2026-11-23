/**
 * Baby log settings: the Group's children, and a way into each one's own
 * settings (ADR-0022). What Baby log has to configure belongs to a Child
 * rather than to the household, so the Module's page is this list.
 *
 * Two doors (APP-611): the gear on the Module pushes it in All's stack,
 * Settings › Modules in the Settings stack; each pushes the Child's page in
 * its own stack, so Back always returns the way it came.
 */
import { useRouter } from 'expo-router'

import { api } from '../../convex/api'
import { useQuery } from '../../convex/queries'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import type { ModuleSettingsDoor } from '../../settings/module-pages'
import { InsetRow } from '../../ui/inset-list'
import {
  SettingsGroup,
  SettingsNote,
  SettingsPage,
} from '../../ui/settings-page'
import { moduleHref } from '../moduleDestination'

export function BabyLogSettingsScreen({ door }: { door: ModuleSettingsDoor }) {
  const { t } = useI18n()
  const router = useRouter()
  const { group } = useGroup()
  const children = useQuery(api.babies.list, { groupSlug: group.slug })

  const openChild = (childId: string) =>
    router.push(
      door === 'all'
        ? moduleHref('/all/baby-log/child', { childId })
        : { pathname: '/settings/baby-log/[childId]', params: { childId } },
    )

  return (
    <SettingsPage
      testID="baby-log-settings"
      title={fmt(t.settings.modulePage.title, {
        module: t.modules.byId['baby-log'].label,
      })}
    >
      {children === undefined ? null : children.length === 0 ? (
        <SettingsNote>{t.baby.log.list.emptyBody}</SettingsNote>
      ) : (
        <SettingsGroup
          footer={fmt(t.settings.modulePage.shared, { group: group.name })}
        >
          {children.map((child) => (
            <InsetRow
              key={child._id}
              testID={`baby-log-settings-${child._id}`}
              title={child.name}
              chevron
              onPress={() => openChild(child._id)}
            />
          ))}
        </SettingsGroup>
      )}
    </SettingsPage>
  )
}
