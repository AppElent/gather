import { useLocalSearchParams } from 'expo-router'
import { TaskDetail } from '../../../../../../src/modules/tasks/TaskDetailScreen'

export default function TaskDetailRoute() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>()
  // Keyed: a link to another record reuses this screen with new params (APP-774).
  return <TaskDetail key={taskId} taskId={taskId} />
}
