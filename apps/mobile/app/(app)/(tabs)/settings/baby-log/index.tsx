import { BabyLogSettingsScreen } from '../../../../../src/modules/baby/BabyLogSettingsScreen'

/**
 * Settings › Modules › Baby log: the page the Module's gear opens (APP-611).
 * A Module's own preferences live inside Settings and never beside it
 * (ADR-0018).
 */
export default function BabyLogSettings() {
  return <BabyLogSettingsScreen door="settings" />
}
