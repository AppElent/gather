import { Redirect, useLocalSearchParams } from 'expo-router'
import { RecentGroceries } from '../../../../../src/modules/tasks/RecentGroceriesScreen'

/** Recent puts items back on the list it was opened from; without one, the list. */
export default function RecentGroceriesRoute() {
  const { listId } = useLocalSearchParams<{ listId?: string }>()
  if (!listId) return <Redirect href="/all/groceries" />
  return <RecentGroceries listId={listId} />
}
