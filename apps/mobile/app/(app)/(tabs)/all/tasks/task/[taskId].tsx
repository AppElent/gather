import { useLocalSearchParams } from 'expo-router'
import { TaskDetail } from '../../../../../../src/modules/tasks/TaskDetailScreen'

export default function TaskDetailRoute() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>()
  return <TaskDetail taskId={taskId} />
}
