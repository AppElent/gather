import { Redirect, useLocalSearchParams } from 'expo-router'
import { AisleOrderScreen } from '../../../../../src/modules/tasks/AisleOrderScreen'
import { ModuleSettingsGate } from '../../../../../src/settings/ModuleSettingsGate'

/** A grocery list's aisle order, pushed from Settings › Modules › Groceries. */
export default function SettingsAisleOrderRoute() {
  const { listId } = useLocalSearchParams<{ listId?: string }>()
  if (!listId) return <Redirect href="/settings/groceries" />
  return (
    <ModuleSettingsGate moduleId="groceries">
      <AisleOrderScreen listId={listId} />
    </ModuleSettingsGate>
  )
}
