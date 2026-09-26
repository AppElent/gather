/** A task opened from Search; Back returns to the results. */
import { useLocalSearchParams } from 'expo-router'
import { TaskDetail } from '../../../../../../src/modules/tasks/TaskDetailScreen'

export default function SearchTask() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>()
  return <TaskDetail taskId={taskId} />
}
