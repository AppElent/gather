import { BabyLogSettingsScreen } from '../../../../../src/modules/baby/BabyLogSettingsScreen'
import { ModuleSettingsGate } from '../../../../../src/settings/ModuleSettingsGate'

/**
 * Settings › Modules › Baby log: the page the Module's gear opens (APP-611).
 * A Module's own preferences live inside Settings and never beside it
 * (ADR-0018).
 */
export default function BabyLogSettings() {
  return (
    <ModuleSettingsGate moduleId="baby-log">
      <BabyLogSettingsScreen door="settings" />
    </ModuleSettingsGate>
  )
}
