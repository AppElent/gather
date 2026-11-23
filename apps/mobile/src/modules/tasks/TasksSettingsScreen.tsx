/**
 * Tasks settings (APP-611): which smart lists the index shows. They used to
 * be the index's ⋯ menu, the only thing in it; a standing choice belongs on
 * the Module's settings page, and the gear took the menu's place.
 */
import { SMART_LISTS } from '@gather/core/smart-lists'

import { fmt, useI18n } from '../../i18n'
import { useHiddenSmartLists } from '../../prefs/hiddenSmartLists'
import {
  SettingsGroup,
  SettingsPage,
  SettingsSwitchRow,
} from '../../ui/settings-page'

export function TasksSettingsScreen() {
  const { t } = useI18n()
  const { hidden, toggle } = useHiddenSmartLists()

  return (
    <SettingsPage
      testID="tasks-settings"
      title={fmt(t.settings.modulePage.title, {
        module: t.modules.byId.tasks.label,
      })}
    >
      <SettingsGroup
        title={t.tasks.smart.section}
        footer={t.settings.modulePage.phoneOnly}
      >
        {SMART_LISTS.map((id) => (
          <SettingsSwitchRow
            key={id}
            testID={`tasks-settings-smart-${id}`}
            title={t.tasks.smart.lists[id].title}
            value={!hidden.includes(id)}
            onValueChange={() => toggle(id)}
          />
        ))}
      </SettingsGroup>
    </SettingsPage>
  )
}
