/**
 * Tasks as both apps draw them: one shape for a local row and a linked one,
 * and the index and smart-list models built from them. Pure, and shared by the
 * phone and the web (APP-308).
 */
import type { TaskProviderId } from './domain'
import type { GroceryAisle, GroceryUnit } from './groceries'
import type { ExternalEntry } from './linkedLists'
import {
  bySmartOrder,
  inSmartList,
  SMART_LISTS,
  type SmartListId,
} from './smartLists'
import {
  type SubtaskProgress,
  subtaskProgress,
  topLevelTasks,
} from './subtasks'
import {
  asTaskListKind,
  type TaskListColor,
  type TaskListIcon,
  type TaskListKind,
  type TaskSection,
  taskListFace,
} from './taskLists'
import { nextDueDate, type TaskRepeat } from './taskRepeat'

export type Priority = 1 | 2 | 3 | 4

export interface ListDisplay {
  due: boolean
  priority: boolean
  labels: boolean
}

/**
 * Where a list's tasks stand. A local list is `live` once Convex has answered;
 * a linked one is `synced` after its provider answered, and `reconnect` or
 * `failed` when it did not, with the last rows still shown (ADR-0021).
 */
export type ListSync = 'live' | 'loading' | 'synced' | 'reconnect' | 'failed'

export interface TaskList {
  id: string
  name: string
  provider: TaskProviderId
  /**
   * Whether its tasks can be written: every local list, and a linked one whose
   * provider can be written to and answered last time (APP-448). Whether the
   * list itself (its name, order, sections) is Gather's is `provider`.
   */
  writable: boolean
  display: ListDisplay
  order: number
  sync: ListSync
  /** What kind of list it is; `plain` for any list made before kinds. */
  kind: TaskListKind
  /** The tile it wears: its own choice, or its kind's (`taskListFace`). */
  icon: TaskListIcon
  color: TaskListColor
  /**
   * Whether its items are groceries, with an amount and an aisle (APP-309):
   * the Group's grocery list, or any list made as one. False from a server
   * older than amounts.
   */
  grocery: boolean
  /**
   * When a Member last chose "Clear checked" (APP-310): items checked before
   * it are only in Recent. Null until the first clear, and from an older
   * server.
   */
  checkedClearedAt: number | null
  /**
   * A grocery list's own aisle order (APP-313), read through `aisleOrder`.
   * Null is the default walking order, and what an older server sends.
   */
  aisleOrder: readonly GroceryAisle[] | null
  /**
   * Whether a Member switched its "Maybe needed" suggestions off (APP-311).
   * False from an older server.
   */
  suggestionsOff: boolean
  /**
   * Its sections in order (APP-357). Empty for a list without any, for a
   * linked list, and from a server older than sections.
   */
  sections: TaskSection[]
}

export interface Task {
  id: string
  listId: string
  title: string
  done: boolean
  dueDate?: string
  priority?: Priority
  labels: string[]
  notes?: string
  /** Where a linked task lives in its own app. */
  sourceUrl?: string
  /** A wishlist item's link and price, in cents. */
  url?: string
  priceCents?: number
  /** A grocery item's amount, unit and aisle (APP-309, APP-353). */
  quantity?: number
  unit?: GroceryUnit
  category?: GroceryAisle
  /** How it comes back once done (APP-303); a Gather list's own. */
  repeat?: TaskRepeat
  /** A linked list's own words for its repeat, such as Todoist's "every week". */
  repeatText?: string
  /** When it was checked (APP-310); absent when open or checked before. */
  doneAt?: number
  /** The Member responsible (APP-302); absent is nobody. */
  assigneeId?: string
  /** Set while the assignee has not opened a task someone else gave them. */
  assignmentNotice?: { by: string; at: number }
  /**
   * The reminder somebody chose (APP-305): a wall clock in the zone it was
   * set in, and the Member it goes to. Only Gather's own lists have one.
   */
  reminder?: TaskReminder
  /** The section it sits in; none, or one that is gone, is "No section". */
  sectionId?: string
  order: number
  /** A linked list's row: its provider holds it, not Convex. */
  linked?: true
  /** A write to it is on its way to the provider. */
  pending?: true
  /**
   * The task it is a step of (APP-304); absent on a task of its own. A list
   * draws a subtask under its parent only, never as a row.
   */
  parentTaskId?: string
  /** How far along its subtasks are; absent when it has none. */
  subtasks?: SubtaskProgress
  /**
   * Its parent's title, for a subtask drawn outside its parent: a smart
   * list's row names what it is a step of.
   */
  parentTitle?: string
}

export interface TaskReminder {
  date: string
  time: string
  timeZone: string
  userId: string
}

/** A list as `taskLists.list` answers it; an older server sends less. */
export interface ListRow {
  _id: string
  name: string
  provider: TaskProviderId
  order: number
  display: ListDisplay
  writable: boolean
  kind?: string | null
  icon?: string | null
  color?: string | null
  grocery?: boolean
  checkedClearedAt?: number | null
  aisleOrder?: readonly GroceryAisle[] | null
  suggestionsOff?: boolean
  sections?: TaskSection[]
  capabilities?: { write: boolean }
}

/** A task as Convex holds it, as much of it as a Task reads. */
export interface TaskRow {
  _id: string
  listId: string
  title: string
  done: boolean
  dueDate?: string
  priority?: Priority
  labels?: string[]
  notes?: string
  url?: string
  priceCents?: number
  quantity?: number
  unit?: GroceryUnit
  category?: GroceryAisle
  repeat?: TaskRepeat
  doneAt?: number
  assigneeId?: string
  assignmentNotice?: { by: string; at: number }
  reminder?: TaskReminder
  sectionId?: string
  order: number
  parentTaskId?: string
}

/** A Convex task row as the screens draw it. */
export function taskFromRow(row: TaskRow): Task {
  return {
    id: row._id,
    listId: row.listId,
    title: row.title,
    done: row.done,
    dueDate: row.dueDate,
    priority: row.priority,
    labels: row.labels ?? [],
    notes: row.notes,
    url: row.url,
    priceCents: row.priceCents,
    quantity: row.quantity,
    unit: row.unit,
    category: row.category,
    repeat: row.repeat,
    doneAt: row.doneAt,
    assigneeId: row.assigneeId,
    assignmentNotice: row.assignmentNotice,
    reminder: row.reminder,
    sectionId: row.sectionId,
    order: row.order,
    parentTaskId: row.parentTaskId,
  }
}

/**
 * Every task with its subtasks' progress (APP-304), worked out from the rows
 * themselves: a list holds a parent's subtasks with it.
 */
export function withProgress(tasks: readonly Task[]): Task[] {
  const progress = subtaskProgress(tasks)
  if (progress.size === 0) return [...tasks]
  return tasks.map((task) => {
    const own = progress.get(task.id)
    return own ? { ...task, subtasks: own } : task
  })
}

/**
 * A list row as the screens draw it, with where its tasks stand. A linked one
 * can be written when its provider can (a server before APP-448 does not say)
 * and its rows are the provider's own; grocery items are Gather's alone.
 */
export function listView(
  list: ListRow,
  sync: ListSync,
  entry?: ExternalEntry,
): TaskList {
  const linkedWritable = Boolean(
    list.capabilities?.write && entry?.fresh && !list.grocery,
  )
  return {
    id: list._id,
    name: list.name,
    provider: list.provider,
    writable: list.provider === 'local' ? list.writable : linkedWritable,
    display: list.display,
    order: list.order,
    sync,
    grocery: list.grocery ?? false,
    checkedClearedAt: list.checkedClearedAt ?? null,
    aisleOrder: list.aisleOrder ?? null,
    suggestionsOff: list.suggestionsOff ?? false,
    sections: list.sections ?? [],
    ...listFace(list),
  }
}

/**
 * A list row's kind and tile. A server older than APP-306 sends none of the
 * three, and a newer one may send a kind this build does not know: both read
 * as a plain list in the kind's face.
 */
export function listFace(list: {
  kind?: string | null
  icon?: string | null
  color?: string | null
}): { kind: TaskListKind; icon: TaskListIcon; color: TaskListColor } {
  return { kind: asTaskListKind(list.kind), ...taskListFace(list) }
}

/** A task as the server will leave it after a tick. */
export function toggled<T extends TaskRow>(
  task: T,
  today: string | undefined,
): T {
  if (task.repeat && !task.done && today) {
    return {
      ...task,
      dueDate: nextDueDate(task.repeat, { dueDate: task.dueDate, today }),
    }
  }
  return {
    ...task,
    done: !task.done,
    // As the server stamps it, so a fresh check is not taken for one from
    // before the last "Clear checked" (APP-310).
    doneAt: task.done ? undefined : Date.now(),
  }
}

/** A list's rows as the server will leave them after one of them is ticked. */
export function toggledRows<T extends TaskRow>(
  rows: readonly T[],
  taskId: string,
  today: string | undefined,
  withSubtasks: boolean | undefined,
): T[] {
  const target = rows.find((task) => task._id === taskId)
  if (!target) return [...rows]
  // "Complete all" (APP-304) checks the open subtasks with it; a repeating
  // parent's next occurrence opens them all again.
  const repeats = Boolean(target.repeat && !target.done && today)
  const closing = !target.done && !repeats
  return rows.map((task) => {
    if (task._id === taskId) return toggled(task, today)
    if (task.parentTaskId !== taskId) return task
    if (repeats && task.done) return { ...task, done: false, doneAt: undefined }
    if (closing && withSubtasks && !task.done) return toggled(task, today)
    return task
  })
}

/** One local list's counts, as `tasks.openCounts` answers them. */
export interface OpenCountsRow {
  listId: string
  open: number
  done?: number
  total?: number
}

/** How a list's tasks stand, top-level tasks only (APP-304). */
export interface ListCount {
  open: number
  /** Only a list that keeps checked items in place (packing) reports these. */
  done?: number
  total?: number
}

/**
 * The Tasks index's lists and how many tasks each holds, from Convex's counts
 * for local lists and the provider's last rows for linked ones (APP-430). A
 * list whose count is not known yet has none.
 */
export function indexModel(
  lists: readonly ListRow[] | undefined,
  answer: readonly OpenCountsRow[] | undefined,
  linked: ReadonlyMap<string, ExternalEntry>,
): {
  lists: TaskList[]
  counts: ReadonlyMap<string, ListCount>
  openTotal: number
} {
  const local = answer && new Map(answer.map((row) => [row.listId, row]))
  const counts = new Map<string, ListCount>()
  const views = (lists ?? []).map((list) => {
    if (list.provider === 'local') {
      // Counts for the whole Group arrive together; a list they do not name
      // yet (just made) has nothing in it.
      if (local) {
        const row = local.get(list._id)
        counts.set(
          list._id,
          row
            ? { open: row.open, done: row.done, total: row.total }
            : { open: 0 },
        )
      }
      return listView(list, local ? 'live' : 'loading')
    }
    const entry = linked.get(list._id)
    if (entry && !(entry.sync === 'loading' && entry.tasks.length === 0)) {
      const rows = topLevelTasks(entry.tasks)
      const done = rows.filter((task) => task.done).length
      counts.set(list._id, {
        open: rows.length - done,
        done,
        total: rows.length,
      })
    }
    return listView(list, entry?.sync ?? 'loading', entry)
  })
  let openTotal = 0
  for (const count of counts.values()) openTotal += count.open
  return { lists: views, counts, openTotal }
}

/** What `tasks.smartLists` answers; the last two absent before APP-304. */
export interface SmartAnswer {
  me: string
  tasks: readonly TaskRow[]
  subtasks?: readonly { taskId: string; done: number; total: number }[]
  parents?: readonly { taskId: string; title: string }[]
}

/** The four smart lists (APP-301), and what their rows need to be drawn. */
export interface SmartLists {
  /** Whether Convex has answered for the lists and the smart rows. */
  loaded: boolean
  today: string
  /** The caller, as Convex knows them; null until it answers. */
  me: string | null
  lists: TaskList[]
  /** Every row any smart list shows, for the hold menu's sheets. */
  tasks: Task[]
  byList: Record<SmartListId, Task[]>
}

/**
 * Convex's smart rows and each linked list's last fetched rows (ADR-0021: a
 * smart list never fetches one), sorted into the four smart lists by the
 * rules in `@gather/core/smart-lists`.
 */
export function smartModel(
  lists: readonly ListRow[] | undefined,
  answer: SmartAnswer | undefined,
  linked: ReadonlyMap<string, ExternalEntry>,
  today: string,
): SmartLists {
  const views = (lists ?? []).map((list) =>
    listView(
      list,
      list.provider === 'local'
        ? answer
          ? 'live'
          : 'loading'
        : (linked.get(list._id)?.sync ?? 'loading'),
      linked.get(list._id),
    ),
  )
  const byId = new Map(views.map((view) => [view.id, view]))
  // A smart list draws a subtask as a row of its own, naming its parent, and
  // a parent with how far along its subtasks are (APP-304). Convex sends both
  // for local rows; a linked list's last rows hold their own subtasks.
  const progress = new Map(
    (answer?.subtasks ?? []).map(({ taskId, done, total }) => [
      taskId,
      { done, total },
    ]),
  )
  const titles = new Map(
    (answer?.parents ?? []).map(({ taskId, title }) => [taskId, title]),
  )
  const linkedRows = withProgress(
    views
      .filter((view) => view.provider !== 'local')
      .flatMap((view) => linked.get(view.id)?.tasks ?? []),
  )
  for (const task of linkedRows) titles.set(task.id, task.title)
  const tasks = [
    ...(answer?.tasks ?? []).map((row) => {
      const task = taskFromRow(row)
      const own = progress.get(task.id)
      return own ? { ...task, subtasks: own } : task
    }),
    ...linkedRows,
  ]
    .filter((task) => byId.has(task.listId))
    .map((task) => {
      const parentTitle = task.parentTaskId
        ? titles.get(task.parentTaskId)
        : undefined
      return parentTitle ? { ...task, parentTitle } : task
    })
  const scope = { today, me: answer?.me ?? null }
  const byList = Object.fromEntries(
    SMART_LISTS.map((id) => [
      id,
      tasks
        .filter((task) => {
          const list = byId.get(task.listId)
          return list ? inSmartList(id, task, list, scope) : false
        })
        .sort(bySmartOrder),
    ]),
  ) as Record<SmartListId, Task[]>
  return {
    loaded: lists !== undefined && answer !== undefined,
    today,
    me: scope.me,
    lists: views,
    tasks,
    byList,
  }
}

/** The linked list among `lists` whose last answer holds the task, if any. */
export function linkedHomeOf(
  lists: readonly ListRow[] | undefined,
  linked: ReadonlyMap<string, ExternalEntry>,
  taskId: string,
): string | undefined {
  return (lists ?? []).find(
    (list) =>
      list.provider !== 'local' &&
      linked.get(list._id)?.tasks.some((task) => task.id === taskId),
  )?._id
}
