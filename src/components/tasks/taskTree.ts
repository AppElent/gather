/**
 * A list's tasks, as rows to draw.
 *
 * The queries return a flat set with each task naming its parent, because that
 * is what a database can check and what reconciliation can rewrite. A card
 * needs the same thing as an outline: parents in order, each one followed by
 * its own children, and every row knowing how deep it is and whether it has a
 * sibling either side of it.
 *
 * Pure and free of React on purpose — the ordering rules are worth testing
 * without rendering anything.
 */

export interface TaskLike {
  _id: string
  done: boolean
  order: number
  parentTaskId?: string
}

export interface TaskTreeRow<T extends TaskLike> {
  task: T
  /** Top level is 0. */
  depth: number
  /** Whether a sibling sits above/below this one, for the move controls. */
  hasPreviousSibling: boolean
  hasNextSibling: boolean
}

/** Open tasks before finished ones, then the order the list carries. */
function byOpenThenOrder(a: TaskLike, b: TaskLike) {
  return Number(a.done) - Number(b.done) || a.order - b.order
}

/**
 * Depth-first, parents before their children.
 *
 * A task whose parent is not in the set is drawn at the top level rather than
 * dropped: it is still one of the list's tasks, and a row that vanishes because
 * of a reference is worse than one drawn a level too high. That happens while a
 * refresh is mid-flight, and settles itself.
 */
export function toTaskTree<T extends TaskLike>(tasks: T[]): TaskTreeRow<T>[] {
  const ids = new Set(tasks.map((t) => t._id))
  const childrenOf = new Map<string, T[]>()
  for (const task of tasks) {
    const parentId =
      task.parentTaskId && ids.has(task.parentTaskId) ? task.parentTaskId : ''
    const siblings = childrenOf.get(parentId) ?? []
    siblings.push(task)
    childrenOf.set(parentId, siblings)
  }

  const rows: TaskTreeRow<T>[] = []
  const walk = (parentId: string, depth: number) => {
    const siblings = (childrenOf.get(parentId) ?? []).sort(byOpenThenOrder)
    siblings.forEach((task, index) => {
      rows.push({
        task,
        depth,
        hasPreviousSibling: index > 0 && siblings[index - 1].done === task.done,
        hasNextSibling:
          index < siblings.length - 1 && siblings[index + 1].done === task.done,
      })
      walk(task._id, depth + 1)
    })
  }
  walk('', 0)
  return rows
}
