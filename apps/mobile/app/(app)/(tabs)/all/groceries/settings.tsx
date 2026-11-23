import { useLocalSearchParams } from 'expo-router'
import { GroceriesSettingsScreen } from '../../../../../src/modules/kitchen/GroceriesSettingsScreen'

/** Groceries settings, behind the Module's gear (APP-611), for the list it was on. */
export default function GroceriesSettingsRoute() {
  const { listId } = useLocalSearchParams<{ listId?: string }>()
  return <GroceriesSettingsScreen door="all" listId={listId} />
}
