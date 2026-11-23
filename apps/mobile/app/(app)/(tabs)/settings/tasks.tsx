import { TasksSettingsScreen } from '../../../../src/modules/tasks/TasksSettingsScreen'
import { ModuleSettingsGate } from '../../../../src/settings/ModuleSettingsGate'

/** Settings › Modules › Tasks: the page the Module's gear opens (APP-611). */
export default function TasksSettingsRoute() {
  return (
    <ModuleSettingsGate moduleId="tasks">
      <TasksSettingsScreen />
    </ModuleSettingsGate>
  )
}
