import { useLocalSearchParams } from 'expo-router'
import { TaskList } from '../../../../../src/modules/tasks/TaskListScreen'

export default function TaskListRoute() {
  const { listId } = useLocalSearchParams<{ listId: string }>()
  return <TaskList listId={listId} />
}
