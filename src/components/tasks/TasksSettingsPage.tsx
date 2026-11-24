import { SMART_LISTS } from '@gather/core/smart-lists'
import { plural, useI18n } from '../../lib/i18n'
import { InsetRow } from '../app/InsetList'
import { ModuleSettingsGroup, ModuleSettingsPage } from '../app/ModuleSettingsPage'
import { useHiddenSmartLists } from './hiddenSmartLists'

/**
 * Tasks settings: which smart lists the index shows in this browser.
 *
 * Nothing links here until the web has smart lists (APP-308): its Tasks index
 * passes `settings={linkTo('tasksSettings')}` to its header and leaves out
 * what `useHiddenSmartLists` hides.
 */
export function TasksSettingsPage() {
  const { locale, messages } = useI18n()
  const { smart } = messages.tasks
  const { hidden, toggle } = useHiddenSmartLists()

  return (
    <ModuleSettingsPage moduleId="tasks"
      summary={{
        count: plural(locale, SMART_LISTS.length - hidden.length, smart.shown),
      }}
    >
      <ModuleSettingsGroup
        title={smart.section}
        footer={messages.shell.modulePage.settingsBrowser}
      >
        {SMART_LISTS.map((id) => (
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
