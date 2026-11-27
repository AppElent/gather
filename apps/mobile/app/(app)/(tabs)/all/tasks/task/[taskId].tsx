import { useLocalSearchParams } from 'expo-router'
import { TaskDetail } from '../../../../../../src/modules/tasks/TaskDetailScreen'

export default function TaskDetailRoute() {
  const { taskId, listId } = useLocalSearchParams<{
    taskId: string
    /** The list it was opened from, when it was opened from one. */
    listId?: string
  }>()
  // Keyed, so no text being typed in one record can reach another (APP-774).
  return <TaskDetail key={taskId} taskId={taskId} listId={listId} />
}
