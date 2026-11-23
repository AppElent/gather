import { Redirect, useLocalSearchParams } from 'expo-router'
import { AisleOrderScreen } from '../../../../../src/modules/tasks/AisleOrderScreen'

/** A grocery list's aisle order, pushed from Settings › Modules › Groceries. */
export default function SettingsAisleOrderRoute() {
  const { listId } = useLocalSearchParams<{ listId?: string }>()
  if (!listId) return <Redirect href="/settings/groceries" />
  return <AisleOrderScreen listId={listId} />
}
