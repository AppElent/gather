import { useLocalSearchParams } from 'expo-router'
import { TaskDetail } from '../../../../../../src/modules/tasks/TaskDetailScreen'

export default function TaskDetailRoute() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>()
  // Keyed, so no text being typed in one record can reach another (APP-774).
  return <TaskDetail key={taskId} taskId={taskId} />
}
