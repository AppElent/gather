// Throwaway branch only. Production builds cannot open the prototype.
import { Redirect } from 'expo-router'
import { NativeTasksPrototype } from '../../../../src/modules/tasks/prototype/NativeTasksPrototype'

export default function TasksPrototypeRoute() {
  if (!__DEV__) return <Redirect href="/all/tasks" />
  return <NativeTasksPrototype />
}
