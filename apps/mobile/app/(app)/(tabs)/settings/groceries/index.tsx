import { GroceriesSettingsScreen } from '../../../../../src/modules/kitchen/GroceriesSettingsScreen'
import { ModuleSettingsGate } from '../../../../../src/settings/ModuleSettingsGate'

/** Settings › Modules › Groceries: the page the Module's gear opens (APP-611). */
export default function GroceriesSettingsRoute() {
  return (
    <ModuleSettingsGate moduleId="groceries">
      <GroceriesSettingsScreen door="settings" />
    </ModuleSettingsGate>
  )
}
