/** Separates the always-visible work from the completed, collapsible history. */
export function taskSections<T extends { done: boolean }>(tasks: readonly T[]) {
  return {
    active: tasks.filter((task) => !task.done),
    completed: tasks.filter((task) => task.done),
  }
}

/** Creates the local value Convex should show while a completion write is pending. */
export function toggledTask<T extends { _id: string; done: boolean }>(
  tasks: readonly T[],
  taskId: string,
): T[] {
  return tasks.map((task) =>
    task._id === taskId ? { ...task, done: !task.done } : task,
  )
}
