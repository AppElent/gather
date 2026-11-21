import { Redirect, useLocalSearchParams } from 'expo-router'
import { ShoppingScreen } from '../../../../../src/modules/tasks/ShoppingScreen'

/** Shopping mode for the grocery list it was started from (APP-315). */
export default function ShoppingRoute() {
  const { listId } = useLocalSearchParams<{ listId?: string }>()
  if (!listId) return <Redirect href="/all/groceries" />
  return <ShoppingScreen listId={listId} />
}
