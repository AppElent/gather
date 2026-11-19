import { useLocalSearchParams } from 'expo-router'
import { RecentGroceries } from '../../../../../src/modules/tasks/RecentGroceriesScreen'

export default function RecentGroceriesRoute() {
  const { listId } = useLocalSearchParams<{ listId: string }>()
  return <RecentGroceries listId={listId} />
}
