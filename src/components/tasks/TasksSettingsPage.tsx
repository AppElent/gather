import { plural, useI18n } from '../../lib/i18n'
import { InsetRow } from '../app/InsetList'
import { ModuleSettingsGroup, ModuleSettingsPage } from '../app/ModuleSettingsPage'
import { SMART_LIST_ROWS, useHiddenSmartLists } from './hiddenSmartLists'

/**
 * Tasks settings: which smart lists the index shows in this browser.
 */
export function TasksSettingsPage() {
  const { locale, messages } = useI18n()
  const { smart } = messages.tasks
  const { hidden, toggle } = useHiddenSmartLists()
  const shown = SMART_LIST_ROWS.filter((id) => !hidden.includes(id))

  return (
    <ModuleSettingsPage moduleId="tasks"
      summary={{
        count: plural(locale, shown.length, smart.shown),
      }}
    >
      <ModuleSettingsGroup
        title={smart.section}
        footer={messages.shell.modulePage.settingsBrowser}
      >
        {SMART_LIST_ROWS.map((id) => (
          <InsetRow
            key={id}
            title={smart.lists[id].title}
            switchedOn={!hidden.includes(id)}
            onClick={() => toggle(id)}
          />
        ))}
      </ModuleSettingsGroup>
    </ModuleSettingsPage>
  )
}
