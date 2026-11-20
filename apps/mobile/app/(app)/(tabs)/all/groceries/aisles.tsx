import { Redirect, useLocalSearchParams } from 'expo-router'
import { AisleOrderScreen } from '../../../../../src/modules/tasks/AisleOrderScreen'

/** The aisle order of the grocery list it was opened from (APP-313). */
export default function AisleOrderRoute() {
  const { listId } = useLocalSearchParams<{ listId?: string }>()
  if (!listId) return <Redirect href="/all/groceries" />
  return <AisleOrderScreen listId={listId} />
}
