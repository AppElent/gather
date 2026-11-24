/**
 * Tasks' one door to the backend: what a Group's lists hold, and every write.
 *
 * Local lists are Convex subscriptions, which the query cache already shares
 * between every screen that mounts them. A linked list is not: its tasks come
 * from Notion or Todoist through an action, so the last answer for each list is
 * kept here, once for the app, and fetched again only when someone asks
 * (ADR-0021: first open, then manual refresh). A failed fetch keeps the last
 * rows readable and says so through the list's `sync`. A write to one goes to
 * the provider first and changes these rows only once it was accepted
 * (`writeLinkedTask`, ADR-0020).
 */
import { localIsoDate } from '@gather/core/civil-date'
import {
  type GroceryAisle,
  type GroceryUnit,
  groceryAddFields,
} from '@gather/core/groceries'
import { applyLinkedWrite } from '@gather/core/linked-tasks'
import {
  bySmartOrder,
  inSmartList,
  SMART_LISTS,
  type SmartListId,
} from '@gather/core/smart-lists'
import { subtaskProgress, topLevelTasks } from '@gather/core/subtasks'
import {
  asTaskListKind,
  type TaskListColor,
  type TaskListIcon,
  type TaskListKind,
  taskListFace,
} from '@gather/core/task-lists'
import type { QuickAdd } from '@gather/core/task-quick-add'
import type { ReminderClock } from '@gather/core/task-reminders'
import { nextDueDate, type TaskRepeat } from '@gather/core/task-repeat'
import type { OptimisticLocalStore } from 'convex/browser'
import { useAction, useConvex, useMutation } from 'convex/react'
import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { api, type Doc, type Id } from '../../convex/api'
import { useQueries, useQuery } from '../../convex/queries'
import { useGroup } from '../../group/GroupProvider'
import { type ComposedTask, parsedTask } from './composerDraft'
import type { ComposedGrocery } from './groceryDraft'
import { deviceTimeZone } from './reminder'
import type { ListDisplay, ListSync, Priority, Task, TaskList } from './types'

type ListRow = FunctionReturnType<typeof api.taskLists.list>[number]
type FetchResult = FunctionReturnType<typeof api.taskLists.getTasks>
type FetchTasks = (listId: string) => Promise<FetchResult>

interface ExternalEntry {
  sync: Exclude<ListSync, 'live'>
  tasks: Task[]
  /**
   * Whether the rows are what the provider last answered, so they may be
   * written to: kept while they load again, lost when that fails.
   */
  fresh?: boolean
}

type LinkedTaskWrite = FunctionArgs<typeof api.taskLists.writeTask>['write']
type WriteResult = FunctionReturnType<typeof api.taskLists.writeTask>
type SendWrite = (
  listId: string,
  write: LinkedTaskWrite,
) => Promise<WriteResult>

export type LinkedWriteFailure =
  /** The connection may not write (any more): nothing was changed. */
  | 'reconnect'
  /** The task is not in the provider's list (any more). */
  | 'not-found'
  /** The rows on screen are not the provider's; they have to load first. */
  | 'stale'
  /** There is no connection, so nothing was sent. */
  | 'offline'
  /** The provider or the network did not answer, or refused. */
  | 'failed'

/** A write to a linked list that its provider did not take. */
export class LinkedWriteError extends Error {
  constructor(
    readonly reason: LinkedWriteFailure,
    readonly listId: string,
  ) {
    super(`A linked list's write was not taken: ${reason}`)
    this.name = 'LinkedWriteError'
  }
}

let external: ReadonlyMap<string, ExternalEntry> = new Map()
const inFlight = new Map<string, Promise<ListSync>>()
const listeners = new Set<() => void>()
/** Each linked list's fetches and writes run one after another. */
const queues = new Map<string, Promise<unknown>>()
/**
 * How many writes are on their way to each task, per list: kept beside the
 * rows, because a refresh replaces those.
 */
const onTheirWay = new Map<string, Map<string, number>>()

/**
 * Lists with a write that outlasted its wait. It may still land, so their rows
 * are not the provider's until it is answered.
 */
const unanswered = new Map<string, number>()

/**
 * How long a write or fetch may take, waiting its turn included. Convex holds
 * an action that lost its connection until it is back, and an answer by then
 * is no use: the list would wait for it, and a write would land unasked.
 */
export const PROVIDER_WAIT_MS = 30_000

function within<T>(promise: Promise<T>, ms = PROVIDER_WAIT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('No answer in time')), ms)
    promise.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

function enqueue<T>(listId: string, job: () => Promise<T>): Promise<T> {
  const run = (queues.get(listId) ?? Promise.resolve()).then(job)
  queues.set(
    listId,
    run.catch(() => {}),
  )
  return run
}

function put(listId: string, entry: ExternalEntry) {
  const busy = onTheirWay.get(listId)
  const tasks = entry.tasks.map((task) => {
    if (Boolean(task.pending) === Boolean(busy?.has(task.id))) return task
    const { pending: _, ...rest } = task
    return busy?.has(task.id) ? { ...rest, pending: true as const } : rest
  })
  external = new Map(external).set(listId, { ...entry, tasks })
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Every linked list's last answer, as one immutable value per change. */
export function externalSnapshot(): ReadonlyMap<string, ExternalEntry> {
  return external
}

/** A provider's answer as rows, or the previous rows marked stale. */
export function externalEntry(
  listId: string,
  result: FetchResult,
  previous: readonly Task[],
): ExternalEntry {
  if (result.status !== 'ok') {
    return {
      sync: result.status === 'reconnect' ? 'reconnect' : 'failed',
      tasks: [...previous],
    }
  }
  return {
    sync: 'synced',
    fresh: true,
    tasks: result.tasks.map((task, order) => linkedTask(listId, task, order)),
  }
}

type ProviderTask = Extract<FetchResult, { status: 'ok' }>['tasks'][number]

function linkedTask(listId: string, task: ProviderTask, order: number): Task {
  return {
    id: task.externalId,
    listId,
    linked: true,
    title: task.title,
    done: task.done,
    dueDate: task.dueDate,
    priority: task.priority,
    labels: task.labels ?? [],
    repeatText: task.repeatText,
    order,
    // Todoist's and Notion's subtasks (APP-304).
    ...(task.parentExternalId ? { parentTaskId: task.parentExternalId } : {}),
  }
}

/** The held rows after the provider took `write` and answered `answered`. */
export function afterLinkedWrite(
  listId: string,
  tasks: readonly Task[],
  write: LinkedTaskWrite,
  answered: readonly ProviderTask[],
): Task[] {
  const orders = new Map(tasks.map((task) => [task.id, task.order]))
  let next = tasks.reduce((most, task) => Math.max(most, task.order + 1), 0)
  const row = (task: Task) => ({
    externalId: task.id,
    done: task.done,
    parentExternalId: task.parentTaskId,
    task,
  })
  return applyLinkedWrite(
    tasks.map(row),
    write,
    answered.map((task) =>
      row(linkedTask(listId, task, orders.get(task.externalId) ?? next++)),
    ),
  ).map(({ task, done }) => (task.done === done ? task : { ...task, done }))
}

/** Marks or unmarks one row as having a write on its way. */
function markPending(listId: string, taskId: string | undefined, on: boolean) {
  if (!taskId) return
  const busy = onTheirWay.get(listId) ?? new Map<string, number>()
  const count = (busy.get(taskId) ?? 0) + (on ? 1 : -1)
  if (count > 0) busy.set(taskId, count)
  else busy.delete(taskId)
  onTheirWay.set(listId, busy)
  const entry = external.get(listId)
  if (entry) put(listId, entry)
}

/**
 * A write to a linked list, made in its provider first (ADR-0020). Nothing
 * changes here until the provider took it; a refusal leaves the rows as they
 * are and rejects. After an unclear failure the list is fetched again, so it
 * shows what the provider has, or goes stale and read-only if that fails too.
 */
export async function writeLinkedTask(
  listId: string,
  write: LinkedTaskWrite,
  send: SendWrite,
  fetchTasks: FetchTasks,
  isOnline: () => boolean = () => true,
): Promise<{ taskId?: string }> {
  const taskId = 'taskId' in write ? write.taskId : undefined
  // Convex would keep an unsent action and send it once back online.
  const refuseOffline = () => {
    if (isOnline()) return
    const entry = external.get(listId)
    if (entry) put(listId, { sync: 'failed', tasks: entry.tasks })
    throw new LinkedWriteError('offline', listId)
  }
  if (!external.get(listId)?.fresh) throw new LinkedWriteError('stale', listId)
  refuseOffline()
  const asked = Date.now()
  markPending(listId, taskId, true)
  let refresh = false
  try {
    return await enqueue(listId, async () => {
      if (!external.get(listId)?.fresh) {
        throw new LinkedWriteError('stale', listId)
      }
      refuseOffline()
      // Waited behind something that hung: too late to act on unasked.
      if (Date.now() - asked >= PROVIDER_WAIT_MS) {
        throw new LinkedWriteError('stale', listId)
      }
      let result: WriteResult
      const sent = send(listId, write)
      let settled = false
      const settle = () => {
        settled = true
      }
      sent.then(settle, settle)
      try {
        result = await within(sent)
      } catch {
        refresh = settled
        if (!settled) {
          const entry = external.get(listId)
          if (entry) put(listId, { sync: 'failed', tasks: entry.tasks })
          unanswered.set(listId, (unanswered.get(listId) ?? 0) + 1)
          const answered = async () => {
            const left = (unanswered.get(listId) ?? 1) - 1
            if (left > 0) unanswered.set(listId, left)
            else unanswered.delete(listId)
            // A fetch begun before this one's answer may not hold it.
            await inFlight.get(listId)
            void syncExternalList(listId, fetchTasks)
          }
          void sent.then(answered, answered)
        }
        throw new LinkedWriteError('failed', listId)
      }
      const entry = external.get(listId) ?? { sync: 'synced', tasks: [] }
      if (result.status === 'reconnect') {
        put(listId, { sync: 'reconnect', tasks: entry.tasks })
        throw new LinkedWriteError('reconnect', listId)
      }
      if (result.status === 'error') {
        refresh = true
        throw new LinkedWriteError(result.reason, listId)
      }
      refresh = result.refresh
      put(listId, {
        ...entry,
        tasks: afterLinkedWrite(listId, entry.tasks, write, result.tasks),
      })
      return { taskId: result.tasks[0]?.externalId }
    })
  } finally {
    markPending(listId, taskId, false)
    if (refresh) void syncExternalList(listId, fetchTasks)
  }
}

/** Asks the provider for one list now; a second ask while one runs joins it. */
export function syncExternalList(
  listId: string,
  fetchTasks: FetchTasks,
): Promise<ListSync> {
  const running = inFlight.get(listId)
  if (running) return running
  put(listId, {
    tasks: [],
    ...external.get(listId),
    sync: 'loading',
  })
  // A write on its way finishes first, so the answer already holds it.
  const run = enqueue(listId, async () => {
    const result = await within(fetchTasks(listId)).catch(() => null)
    const previous = external.get(listId)?.tasks ?? []
    const entry: ExternalEntry = result
      ? externalEntry(listId, result, previous)
      : { sync: 'failed', tasks: previous }
    // An unanswered write may still change what was just read.
    put(listId, unanswered.has(listId) ? { ...entry, fresh: false } : entry)
    return entry.sync
  }).finally(() => inFlight.delete(listId))
  inFlight.set(listId, run)
  return run
}

/**
 * Fetches the linked lists nobody has an answer for yet. A list that failed
 * is asked again on the next open, since reconnecting happens elsewhere.
 */
export function ensureExternalLists(
  listIds: readonly string[],
  fetchTasks: FetchTasks,
) {
  for (const listId of listIds) {
    const sync = external.get(listId)?.sync
    if (sync !== 'loading' && sync !== 'synced') {
      void syncExternalList(listId, fetchTasks)
    }
  }
}

/**
 * The dynamic local-list subscriptions for one Group.
 *
 * `useQueries` owns subscription state, so its complete request object must be
 * stable between renders that do not change the Group or its local lists.
 */
export function localTaskQueries(
  lists: readonly Pick<Doc<'taskLists'>, '_id' | 'provider'>[],
  groupSlug: string,
) {
  return Object.fromEntries(
    lists
      .filter((list) => list.provider === 'local')
      .map((list) => [
        list._id,
        {
          query: api.tasks.listByList,
          args: { listId: list._id, groupSlug },
        },
      ]),
  )
}

/** A Convex task row as the screens draw it. */
export function taskFromRow(row: Doc<'tasks'>): Task {
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
function listView(
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

/** Local rows and linked rows as one model: the only place the two meet. */
export function mergeTasks(
  lists: readonly ListRow[],
  local: Readonly<Record<string, unknown>>,
  linked: ReadonlyMap<string, ExternalEntry>,
): { lists: TaskList[]; tasks: Task[] } {
  const tasks: Task[] = []
  const views = lists.map((list): TaskList => {
    let sync: ListSync
    let entry: ExternalEntry | undefined
    if (list.provider === 'local') {
      const rows = local[list._id]
      // `useQueries` hands back the Error a failed subscription threw.
      sync = Array.isArray(rows)
        ? 'live'
        : rows instanceof Error
          ? 'failed'
          : 'loading'
      if (Array.isArray(rows)) {
        for (const row of rows as Doc<'tasks'>[]) tasks.push(taskFromRow(row))
      }
    } else {
      entry = linked.get(list._id)
      sync = entry?.sync ?? 'loading'
      tasks.push(...(entry?.tasks ?? []))
    }
    return listView(list, sync, entry)
  })
  return { lists: views, tasks: withProgress(tasks) }
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

export function taskSections<T extends { done: boolean }>(tasks: readonly T[]) {
  return {
    active: tasks.filter((task) => !task.done),
    completed: tasks.filter((task) => task.done),
  }
}

/**
 * Ticks a task in every cached list that holds it, before the server agrees.
 * An open repeating task is not ticked: it stays open on its next date, the
 * date the server will work out from the same rule (APP-303).
 */
export function toggleInPlace(
  store: OptimisticLocalStore,
  {
    taskId,
    today,
    withSubtasks,
  }: { taskId: Id<'tasks'>; today?: string; withSubtasks?: boolean },
) {
  for (const { args, value } of store.getAllQueries(api.tasks.listByList)) {
    const target = value?.find((task) => task._id === taskId)
    if (!value || !target) continue
    // "Complete all" (APP-304) checks the open subtasks with it; a repeating
    // parent's next occurrence opens them all again.
    const repeats = Boolean(target.repeat && !target.done && today)
    const closing = !target.done && !repeats
    store.setQuery(
      api.tasks.listByList,
      args,
      value.map((task) => {
        if (task._id === taskId) return toggled(task, today)
        if (task.parentTaskId !== taskId) return task
        if (repeats && task.done) return { ...task, done: false, doneAt: undefined }
        if (closing && withSubtasks && !task.done) return toggled(task, today)
        return task
      }),
    )
  }
  // A smart list holds open tasks only: a checked one leaves it at once, and
  // a repeating one stays with its next date (APP-301).
  for (const { args, value } of store.getAllQueries(api.tasks.smartLists)) {
    const target = value?.tasks.find((task) => task._id === taskId)
    if (!value || !target) continue
    // "Complete all" takes the parent's open subtasks off with it (APP-304).
    const closing = withSubtasks && !target.done && !target.repeat
    store.setQuery(api.tasks.smartLists, args, {
      ...value,
      tasks: value.tasks.flatMap((task) => {
        if (closing && task.parentTaskId === taskId) return []
        if (task._id !== taskId) return [task]
        const next = toggled(task, today)
        return next.done ? [] : [next]
      }),
    })
  }
}

/** A task as the server will leave it after a tick. */
function toggled(task: Doc<'tasks'>, today: string | undefined): Doc<'tasks'> {
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

/**
 * A repeating task that was just completed, for the screen that shows the
 * undo toast. Any row or menu can complete one, so the news goes through
 * here rather than up through every caller.
 */
export interface CompletedOccurrence {
  taskId: string
  title: string
  completionId: Id<'taskCompletions'>
  dueDate: string
}

const completionListeners = new Set<(done: CompletedOccurrence) => void>()

export function onOccurrenceCompleted(
  listener: (done: CompletedOccurrence) => void,
) {
  completionListeners.add(listener)
  return () => {
    completionListeners.delete(listener)
  }
}

export function announceCompletion(done: CompletedOccurrence) {
  for (const listener of completionListeners) listener(done)
}

const NO_LISTS: readonly ListRow[] = []

/**
 * The linked lists' last answers, and a way to ask for one again. A linked
 * list is fetched once when first seen (ADR-0021); a local list is never asked.
 */
function useLinkedLists(lists: readonly ListRow[]) {
  const { group } = useGroup()
  const linked = useSyncExternalStore(subscribe, externalSnapshot)
  const getTasks = useAction(api.taskLists.getTasks)
  const fetchTasks = useCallback(
    (listId: string) =>
      getTasks({ listId: listId as Id<'taskLists'>, groupSlug: group.slug }),
    [getTasks, group.slug],
  )
  const linkedIds = lists
    .filter((list) => list.provider !== 'local')
    .map((list) => list._id)
    .join(',')
  useEffect(() => {
    if (linkedIds) ensureExternalLists(linkedIds.split(','), fetchTasks)
  }, [linkedIds, fetchTasks])
  const refresh = useCallback(
    (listId: string) => syncExternalList(listId, fetchTasks),
    [fetchTasks],
  )
  return { linked, refresh }
}

function useListsOf(lists: readonly ListRow[]) {
  const { group } = useGroup()
  const localQueries = useMemo(
    () => localTaskQueries(lists, group.slug),
    [lists, group.slug],
  )
  const local = useQueries(localQueries)
  const { linked, refresh } = useLinkedLists(lists)
  return { ...mergeTasks(lists, local, linked), refresh }
}

/**
 * The Current Group's lists as names and settings, without their tasks: no
 * task subscription and no provider fetch. `undefined` until Convex answers.
 */
export function useTaskLists(): readonly ListRow[] | undefined {
  const { group } = useGroup()
  return useQuery(api.taskLists.list, { groupSlug: group.slug })
}

/** Every list in the Current Group, and every task on them. */
export function useTaskState() {
  const lists = useTaskLists()
  const state = useListsOf(lists ?? NO_LISTS)
  return { today: localIsoDate(), ...state }
}

/**
 * Every local list in the Current Group, and every task on them, without
 * asking Notion or Todoist for anything: Home reads only what Convex already
 * holds (ADR-0021 keeps a provider fetch behind opening its list).
 */
export function useLocalTaskState() {
  const lists = useTaskLists()
  const local = useMemo(
    () => (lists ?? NO_LISTS).filter((list) => list.provider === 'local'),
    [lists],
  )
  const state = useListsOf(local)
  return { today: localIsoDate(), loaded: lists !== undefined, ...state }
}

/**
 * One list and its tasks in their order, without subscribing to the rest of
 * the Group's lists or asking any other provider.
 */
export function useTaskList(listId: string) {
  const lists = useTaskLists()
  const only = useMemo(
    () => (lists ?? NO_LISTS).filter((list) => list._id === listId),
    [lists, listId],
  )
  const state = useListsOf(only)
  return {
    today: localIsoDate(),
    list: state.lists[0],
    tasks: [...state.tasks].sort((a, b) => a.order - b.order),
    refresh: () => state.refresh(listId),
  }
}

/** The linked list among `lists` whose last answer holds the task, if any. */
export function linkedHomeOf(
  lists: readonly ListRow[] | undefined,
  linked: ReadonlyMap<string, ExternalEntry>,
  taskId: string,
): string | undefined {
  return (lists ?? NO_LISTS).find(
    (list) =>
      list.provider !== 'local' &&
      linked.get(list._id)?.tasks.some((task) => task.id === taskId),
  )?._id
}

/**
 * One task's list and its tasks (APP-565: the task's detail screen), without
 * subscribing to the rest of the Group's lists. A linked task is found in its
 * list's last answer; any other is placed by `tasks.listOf`. Only a task
 * neither knows (a linked one nobody has fetched yet, say from Recents) asks
 * the Group's linked lists, as opening them would. `task` stays the last row
 * seen while the server still places it, so moving it to another list does
 * not blank the screen while that list's rows arrive.
 */
export function useTaskOf(taskId: string) {
  const { group } = useGroup()
  const lists = useTaskLists()
  const linked = useSyncExternalStore(subscribe, externalSnapshot)
  const linkedHome = linkedHomeOf(lists, linked, taskId)
  const localHome = useQuery(
    api.tasks.listOf,
    linkedHome ? 'skip' : { groupSlug: group.slug, taskId },
  )
  const home = linkedHome ?? localHome ?? undefined
  const unknown = !linkedHome && localHome === null
  const only = useMemo(() => {
    const all = lists ?? NO_LISTS
    if (home) return all.filter((list) => list._id === home)
    if (unknown) return all.filter((list) => list.provider !== 'local')
    return NO_LISTS
  }, [lists, home, unknown])
  const state = useListsOf(only)
  const found = state.tasks.find((task) => task.id === taskId)
  const last = useRef<Task | undefined>(undefined)
  if (found) last.current = found
  else if (!home) last.current = undefined
  return {
    today: localIsoDate(),
    lists: state.lists,
    tasks: state.tasks,
    task: found ?? last.current,
  }
}

/**
 * Every label typed in the Current Group (APP-565: the Labels sheet's
 * suggestions): one `tasks.labels` subscription for the local lists, and the
 * last fetched rows of its linked lists, without asking any provider.
 */
export function useGroupLabels(): readonly string[] {
  const { group } = useGroup()
  const lists = useTaskLists()
  const local = useQuery(api.tasks.labels, { groupSlug: group.slug })
  const linked = useSyncExternalStore(subscribe, externalSnapshot)
  return useMemo(() => {
    const found = new Set(local ?? [])
    for (const list of lists ?? NO_LISTS) {
      if (list.provider === 'local') continue
      for (const task of linked.get(list._id)?.tasks ?? []) {
        for (const label of task.labels) found.add(label)
      }
    }
    return Array.from(found).sort()
  }, [local, lists, linked])
}

/**
 * The tasks of the given lists only (APP-313: the Grocery lists sheet's
 * counts). `lists` must be memoised by the caller, as `useQueries` needs.
 */
export function useTasksOf(lists: readonly ListRow[]) {
  return useListsOf(lists)
}

type OpenCountsRow = FunctionReturnType<typeof api.tasks.openCounts>[number]

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
  const views = (lists ?? NO_LISTS).map((list) => {
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

/**
 * The Tasks index's lists and counts: one Convex subscription for every local
 * list's counts, never a subscription to a list's rows. A linked list is
 * fetched from its provider once, as anywhere else (ADR-0021).
 */
export function useTaskIndex() {
  const { group } = useGroup()
  const lists = useTaskLists()
  const answer = useQuery(api.tasks.openCounts, { groupSlug: group.slug })
  const { linked } = useLinkedLists(lists ?? NO_LISTS)
  return useMemo(
    () => indexModel(lists, answer, linked),
    [lists, answer, linked],
  )
}

type SmartAnswerRow = FunctionReturnType<typeof api.tasks.smartLists>
/** The answer; `subtasks` and `parents` are absent from a server before APP-304. */
type SmartAnswer = Omit<SmartAnswerRow, 'subtasks' | 'parents'> &
  Partial<Pick<SmartAnswerRow, 'subtasks' | 'parents'>>

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
  const views = (lists ?? NO_LISTS).map((list) =>
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
      taskId as string,
      { done, total },
    ]),
  )
  const titles = new Map(
    (answer?.parents ?? []).map(({ taskId, title }) => [taskId as string, title]),
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

/**
 * The Current Group's smart lists: one Convex subscription for every local
 * list's open rows, plus whatever the linked lists last answered.
 */
export function useSmartLists(): SmartLists {
  const { group } = useGroup()
  const today = localIsoDate()
  const lists = useTaskLists()
  const answer = useQuery(api.tasks.smartLists, {
    groupSlug: group.slug,
    today,
  })
  const linked = useSyncExternalStore(subscribe, externalSnapshot)
  return useMemo(
    () => smartModel(lists, answer, linked, today),
    [lists, answer, linked, today],
  )
}

/** Every write Tasks makes, in the Current Group. */
/** How the note and reminder written after a composed task went. */
export interface ComposedDetails {
  notesFailed: boolean
  reminderFailed: boolean
  /** A reminder went in with this write: the moment to ask to notify. */
  reminderSet: boolean
  /** Writes again only what failed, onto the same task; none when all went in. */
  retry?: () => Promise<ComposedDetails>
}

/**
 * What a task's note and reminder writes came to, each on its own: a reminder
 * that went in is set even when the note failed, and what failed is what a
 * retry writes again.
 */
export function settledDetails(
  details: Pick<ComposedTask, 'notes' | 'reminder'>,
  notes: PromiseSettledResult<unknown>,
  reminder: PromiseSettledResult<unknown>,
): Omit<ComposedDetails, 'retry'> & {
  failed: Pick<ComposedTask, 'notes' | 'reminder'>
} {
  const failed = {
    notes: notes.status === 'rejected' ? details.notes : undefined,
    reminder: reminder.status === 'rejected' ? details.reminder : undefined,
  }
  return {
    notesFailed: failed.notes !== undefined,
    reminderFailed: failed.reminder !== undefined,
    reminderSet: details.reminder !== undefined && reminder.status === 'fulfilled',
    failed,
  }
}

/** A name on In stock; `created` is false for one the Group already had. */
export interface AddedStaple {
  id: Id<'groceryStaples'>
  created: boolean
}

/** A grocery item's whole amount; null is a part it does not have. */
export interface WholeAmount {
  quantity: number | null
  unit: GroceryUnit | null
}

/** What an item's own writes after its add came to. */
export interface GroceryDetails {
  /** The staple it is now, and whether this add made it. */
  staple?: AddedStaple
  /** Writes again only what failed; none when all went in. */
  retry?: () => Promise<GroceryDetails>
}

/** A task as a write names it: a linked one by its own list. */
type TaskRef = Pick<Task, 'id'> & Partial<Pick<Task, 'listId' | 'linked'>>

/** A linked task's list. Two lists can show the same provider task. */
function linkedListOf(task: TaskRef) {
  return task.linked ? task.listId : undefined
}

export function useTaskActions() {
  const { group } = useGroup()
  const groupSlug = group.slug
  const add = useMutation(api.tasks.add)
  const toggle = useMutation(api.tasks.toggleDone).withOptimisticUpdate(
    toggleInPlace,
  )
  const update = useMutation(api.tasks.update)
  const addAmount = useMutation(api.tasks.addAmount)
  const addStapleRow = useMutation(api.groceryStaples.add)
  const removeStaple = useMutation(api.groceryStaples.remove)
  const remove = useMutation(api.tasks.remove)
  const moveToList = useMutation(api.tasks.moveToList)
  const reorder = useMutation(api.tasks.reorder)
  const updateDisplay = useMutation(api.taskLists.updateDisplay)
  const renameList = useMutation(api.taskLists.rename)
  const removeList = useMutation(api.taskLists.remove)
  const renameLabel = useMutation(api.tasks.renameLabel)
  const removeLabel = useMutation(api.tasks.removeLabel)
  const createList = useMutation(api.taskLists.create)
  const setAppearance = useMutation(api.taskLists.setAppearance)
  const setDoneInList = useMutation(api.tasks.setDoneInList)
  const undoCompletion = useMutation(api.tasks.undoCompletion)
  const clearChecked = useMutation(api.taskLists.clearCheckedUndoable)
  const restoreCheckedCleared = useMutation(api.taskLists.restoreCheckedCleared)
  const setAisleOrder = useMutation(api.taskLists.setAisleOrder)
  const putBack = useMutation(api.tasks.putBack)
  const putBackChecked = useMutation(api.tasks.putBackChecked)
  const removePutBack = useMutation(api.tasks.removePutBack)
  const setSuggestions = useMutation(api.taskLists.setSuggestions)
  const hideSuggestion = useMutation(api.taskLists.hideSuggestion)
  const unhideSuggestion = useMutation(api.taskLists.unhideSuggestion)
  const markSeen = useMutation(api.tasks.markAssignmentSeen)
  const reorderSubtasks = useMutation(api.tasks.reorderSubtasks)
  const setReminder = useMutation(api.tasks.setReminder)
  const setSection = useMutation(api.tasks.setSection)
  const addSection = useMutation(api.taskSections.add)
  const renameSection = useMutation(api.taskSections.rename)
  const reorderSections = useMutation(api.taskSections.reorder)
  const removeSection = useMutation(api.taskSections.remove)

  const getTasks = useAction(api.taskLists.getTasks)
  const sendWrite = useAction(api.taskLists.writeTask)
  const convex = useConvex()

  const write = (listId: string, change: LinkedTaskWrite) =>
    writeLinkedTask(
      listId,
      change,
      (id, sent) =>
        sendWrite({
          listId: id as Id<'taskLists'>,
          groupSlug,
          write: sent,
        }),
      (id) => getTasks({ listId: id as Id<'taskLists'>, groupSlug }),
      () => convex.connectionState().isWebSocketConnected,
    )

  /** A linked task's fields in its provider, or a local one's in Convex. */
  const edit = (
    task: TaskRef,
    fields: {
      title?: string
      dueDate?: string | null
      priority?: Priority | null
      labels?: string[]
    },
  ): Promise<unknown> => {
    const listId = linkedListOf(task)
    return listId
      ? write(listId, { kind: 'update', taskId: task.id, ...fields })
      : patch(task.id, fields)
  }

  const patch = (
    id: string,
    fields: Omit<Parameters<typeof update>[0], 'taskId' | 'groupSlug'>,
  ) => update({ taskId: id as Id<'tasks'>, groupSlug, ...fields })

  /** The note and reminder `add` does not take, as writes of their own. */
  const composedDetails = async (
    taskId: string,
    details: Pick<ComposedTask, 'notes' | 'reminder'>,
  ): Promise<ComposedDetails> => {
    const [notes, reminder] = await Promise.allSettled([
      details.notes ? patch(taskId, { notes: details.notes }) : null,
      details.reminder
        ? setReminder({
            taskId: taskId as Id<'tasks'>,
            groupSlug,
            reminder: { ...details.reminder, timeZone: deviceTimeZone() },
          })
        : null,
    ])
    const { failed, ...outcome } = settledDetails(details, notes, reminder)
    return {
      ...outcome,
      retry:
        outcome.notesFailed || outcome.reminderFailed
          ? () => composedDetails(taskId, failed)
          : undefined,
    }
  }

  const addComposed = async (
    listId: string,
    task: ComposedTask,
    saveKey: string | undefined,
    sectionId?: string,
  ): Promise<{ taskId: string } & ComposedDetails> => {
    if (external.has(listId)) {
      // The composer offers only what the provider can hold (APP-448).
      const { taskId } = await write(listId, {
        kind: 'create',
        title: task.title,
        ...(saveKey ? { requestKey: saveKey } : {}),
        ...(task.dueDate ? { dueDate: task.dueDate } : {}),
        ...(task.labels.length > 0 ? { labels: task.labels } : {}),
        ...(task.priority ? { priority: task.priority } : {}),
      })
      return {
        taskId: taskId ?? '',
        notesFailed: false,
        reminderFailed: false,
        reminderSet: false,
      }
    }
    const taskId = await add({
      listId: listId as Id<'taskLists'>,
      groupSlug,
      title: task.title,
      today: localIsoDate(),
      // The draft's own key: sent twice (a close and reopen mid-save, or a
      // retry after a lost answer), it still makes one task.
      ...(saveKey ? { idempotencyKey: saveKey } : {}),
      ...(task.dueDate ? { dueDate: task.dueDate } : {}),
      ...(task.repeat ? { repeat: task.repeat } : {}),
      ...(task.assigneeId
        ? { assigneeId: task.assigneeId as Id<'users'> }
        : {}),
      ...(task.labels.length > 0 ? { labels: task.labels } : {}),
      ...(task.priority ? { priority: task.priority } : {}),
      ...(sectionId ? { sectionId } : {}),
    })
    // `add` takes no notes and no reminder: both are their own writes, so
    // an installed server from before the composer is all this needs.
    return { taskId, ...(await composedDetails(taskId, task)) }
  }

  const addStaple = async (name: string): Promise<AddedStaple> => {
    const answer = await addStapleRow({ groupSlug, name, report: true })
    // Always the report when asked for one; an id alone says nothing of who
    // made it, so it is not ours.
    return typeof answer === 'string' ? { id: answer, created: false } : answer
  }

  const groceryDetails = async (
    taskId: string,
    item: Pick<ComposedGrocery, 'title' | 'aisle' | 'note' | 'staple'>,
  ): Promise<GroceryDetails> => {
    const [aisle, note, staple] = await Promise.allSettled([
      item.aisle ? patch(taskId, { category: item.aisle }) : null,
      item.note ? patch(taskId, { notes: item.note }) : null,
      item.staple ? addStaple(item.title) : null,
    ])
    const failed = {
      title: item.title,
      aisle: aisle.status === 'rejected' ? item.aisle : undefined,
      note: note.status === 'rejected' ? item.note : undefined,
      staple: staple.status === 'rejected',
    }
    return {
      staple: staple.status === 'fulfilled' ? (staple.value ?? undefined) : undefined,
      retry:
        failed.aisle || failed.note || failed.staple
          ? () => groceryDetails(taskId, failed)
          : undefined,
    }
  }

  return {
    /**
     * A line onto a list. On a grocery list the amount is read off it first
     * ("2 pakken melk" is "melk", 2 pak), here rather than on the server, so
     * an installed app that sends only the line keeps it as typed (APP-309).
     * `sectionId` is the section the composer sits in (APP-357).
     */
    addTask: (
      listId: string,
      title: string,
      grocery = false,
      sectionId?: string,
    ) =>
      add({
        listId: listId as Id<'taskLists'>,
        groupSlug,
        ...(grocery ? groceryAddFields(title) : { title }),
        ...(sectionId ? { sectionId } : {}),
      }),
    /**
     * A quick-add line onto a list (APP-307): the title with what was
     * recognised in it as the task's fields. A time becomes the caller's
     * reminder, written once the task exists; if that write fails the task
     * stays, without it, and the answer says so.
     */
    addParsedTask: async (
      listId: string,
      parsed: QuickAdd,
      sectionId?: string,
    ): Promise<{ taskId: string; reminderFailed: boolean }> =>
      addComposed(listId, parsedTask(parsed), undefined, sectionId),
    /**
     * A task from the keyboard composer (APP-587), every detail it was given
     * at once. Notes and a reminder are written once the task exists; the
     * task stays if either fails, and the answer says which.
     */
    addComposedTask: (
      listId: string,
      task: ComposedTask,
      saveKey: string,
      sectionId?: string,
    ) => addComposed(listId, task, saveKey, sectionId),
    /**
     * Ticks a task, or completes a repeating one's open occurrence. The
     * phone's own day goes along, so "after done" counts from it.
     */
    toggleTask: async (
      task: TaskRef & Pick<Task, 'title'>,
      options: { withSubtasks?: boolean } = {},
    ) => {
      const linkedId = linkedListOf(task)
      if (linkedId) {
        const row = external
          .get(linkedId)
          ?.tasks.find((each) => each.id === task.id)
        await write(linkedId, {
          kind: 'setDone',
          taskId: task.id,
          done: !row?.done,
          ...(options.withSubtasks ? { withSubtasks: true } : {}),
        })
        return null
      }
      const completion = await toggle({
        taskId: task.id as Id<'tasks'>,
        groupSlug,
        today: localIsoDate(),
        // Only "Complete all" sends it (APP-304).
        ...(options.withSubtasks ? { withSubtasks: true } : {}),
      })
      if (completion) {
        announceCompletion({ taskId: task.id, title: task.title, ...completion })
      }
      return completion
    },
    /** Puts the previous date back and forgets the completion. */
    undoCompletion: (completionId: Id<'taskCompletions'>) =>
      undoCompletion({ completionId, groupSlug }),
    /** A rule, or null for no repeat; the server anchors it on the date. */
    setRepeat: (id: string, repeat: TaskRepeat | null) =>
      patch(id, { repeat, today: localIsoDate() }),
    renameTask: (task: TaskRef, title: string) => edit(task, { title }),
    setDue: (task: TaskRef, value: string | undefined) =>
      edit(task, { dueDate: value ?? null }),
    setPriority: (task: TaskRef, value: Priority | undefined) =>
      edit(task, { priority: value ?? null }),
    setLabels: (task: TaskRef, labels: string[]) => edit(task, { labels }),
    setNotes: (id: string, notes: string) => patch(id, { notes }),
    deleteTask: (id: string) =>
      remove({ taskId: id as Id<'tasks'>, groupSlug }),
    /** A linked task under another on its list, or out of it with null. */
    moveUnder: (task: Pick<Task, 'id' | 'listId'>, parentId: string | null) =>
      write(task.listId, { kind: 'move', taskId: task.id, parentId }),
    moveTask: (id: string, listId: string) =>
      moveToList({
        taskId: id as Id<'tasks'>,
        groupSlug,
        listId: listId as Id<'taskLists'>,
      }),
    /**
     * The tasks in their new order; with `sectionIds`, each one's section
     * after the drag, by position (null is "No section", APP-357).
     */
    reorderTasks: (
      listId: string,
      ids: string[],
      sectionIds?: (string | null)[],
    ) =>
      reorder({
        listId: listId as Id<'taskLists'>,
        groupSlug,
        ids: ids as Id<'tasks'>[],
        ...(sectionIds ? { sectionIds } : {}),
      }),
    /** Into a section of its own list, or out of every section with null. */
    setTaskSection: (id: string, sectionId: string | null) =>
      setSection({ taskId: id as Id<'tasks'>, groupSlug, sectionId }),
    addSection: (listId: string, name: string) =>
      addSection({ listId: listId as Id<'taskLists'>, groupSlug, name }),
    renameSection: (listId: string, sectionId: string, name: string) =>
      renameSection({
        listId: listId as Id<'taskLists'>,
        groupSlug,
        sectionId,
        name,
      }),
    reorderSections: (listId: string, sectionIds: string[]) =>
      reorderSections({
        listId: listId as Id<'taskLists'>,
        groupSlug,
        sectionIds,
      }),
    /** Its tasks stay on the list, under "No section". */
    deleteSection: (listId: string, sectionId: string) =>
      removeSection({
        listId: listId as Id<'taskLists'>,
        groupSlug,
        sectionId,
      }),
    /** One option changes; the others keep the list's current value. */
    setListDisplay: (list: TaskList, change: Partial<ListDisplay>) =>
      updateDisplay({
        listId: list.id as Id<'taskLists'>,
        groupSlug,
        display: { ...list.display, ...change },
      }),
    renameList: (id: string, name: string) =>
      renameList({ listId: id as Id<'taskLists'>, groupSlug, name }),
    deleteList: (id: string) =>
      removeList({ listId: id as Id<'taskLists'>, groupSlug }),
    renameLabel: (from: string, to: string) =>
      renameLabel({ groupSlug, from, to }),
    removeLabel: (label: string) => removeLabel({ groupSlug, label }),
    /** A local list from the New list sheet, with its template's items. */
    createList: (fields: {
      name: string
      kind: TaskListKind
      icon: TaskListIcon
      color: TaskListColor
      /** The template's items in their sections, in the Group's words. */
      starterSections: { name: string; tasks: string[] }[]
      idempotencyKey: string
    }) =>
      // This build opens a grocery list by id (APP-313), so a new one leaves
      // the list installed phones open where it is.
      createList({
        groupSlug,
        provider: 'local',
        keepGroceryList: true,
        ...fields,
      }),
    setListAppearance: (
      id: string,
      face: { icon?: TaskListIcon; color?: TaskListColor },
    ) =>
      setAppearance({ listId: id as Id<'taskLists'>, groupSlug, ...face }),
    /** Every item on a list, or only `ids`, checked or unchecked at once. */
    setDoneInList: (listId: string, done: boolean, ids?: string[]) =>
      setDoneInList({
        listId: listId as Id<'taskLists'>,
        groupSlug,
        done,
        taskIds: ids as Id<'tasks'>[] | undefined,
      }),
    setUrl: (id: string, url: string | null) => patch(id, { url }),
    setPrice: (id: string, priceCents: number | null) =>
      patch(id, { priceCents }),
    /**
     * A grocery item's amount and unit; null clears either (APP-309). Refused
     * as `amount-changed` when it is no longer `expected` (APP-671).
     */
    setAmount: (id: string, to: WholeAmount, expected: WholeAmount) =>
      patch(id, { ...to, expectedAmount: expected }),
    /** More of an item, on top of what it has then (APP-671). */
    addAmount: (id: string, more: { quantity?: number; unit?: GroceryUnit }) =>
      addAmount({
        taskId: id as Id<'tasks'>,
        groupSlug,
        ...(more.quantity !== undefined ? { quantity: more.quantity } : {}),
        ...(more.unit !== undefined ? { unit: more.unit } : {}),
      }),
    /** A reminder for the caller at this wall clock, or none (APP-305). */
    setReminder: (id: string, clock: ReminderClock | null) =>
      setReminder({ taskId: id as Id<'tasks'>, groupSlug, reminder: clock }),
    /** The aisle a Member chose; the Group keeps it for the name. */
    setAisle: (id: string, category: GroceryAisle) => patch(id, { category }),
    /**
     * "Clear checked" on a grocery list (APP-310). Answers the moment it
     * cleared and the one it replaced; the undo passes both back, so it puts
     * back only this clear, never one another Member made since (APP-403).
     */
    clearChecked: (listId: string) =>
      clearChecked({ listId: listId as Id<'taskLists'>, groupSlug }),
    restoreCheckedCleared: (
      listId: string,
      cleared: { clearedAt: number; previous: number | null },
    ) =>
      restoreCheckedCleared({
        listId: listId as Id<'taskLists'>,
        groupSlug,
        checkedClearedAt: cleared.previous,
        clearedAt: cleared.clearedAt,
      }),
    /**
     * A grocery list's aisle order, the way its store is walked (APP-313);
     * null restores the default walking order.
     */
    setAisleOrder: (listId: string, order: readonly GroceryAisle[] | null) =>
      setAisleOrder({
        listId: listId as Id<'taskLists'>,
        groupSlug,
        order: order ? [...order] : null,
      }),
    /** A Recent item back onto a grocery list, with its amount and aisle. */
    putBack: (taskId: string, listId: string) =>
      putBack({
        taskId: taskId as Id<'tasks'>,
        listId: listId as Id<'taskLists'>,
        groupSlug,
      }),
    /**
     * A grocery list's "Put back all" (APP-427): open copies of its checked
     * items, which stay in the history. Answers the copies, for the undo.
     */
    putBackChecked: (listId: string, taskIds: string[]) =>
      putBackChecked({
        listId: listId as Id<'taskLists'>,
        groupSlug,
        taskIds: taskIds as Id<'tasks'>[],
      }),
    /** The undo of `putBackChecked`: its copies still open leave the list. */
    removePutBack: (listId: string, taskIds: string[]) =>
      removePutBack({
        listId: listId as Id<'taskLists'>,
        groupSlug,
        taskIds: taskIds as Id<'tasks'>[],
      }),
    /**
     * A grocery item with a known amount onto a grocery list: a suggestion or
     * an autocomplete row (APP-311). The server picks its aisle as for any
     * typed line.
     */
    addGrocery: (
      listId: string,
      item: { title: string; quantity?: number; unit?: GroceryUnit },
    ) =>
      add({
        listId: listId as Id<'taskLists'>,
        groupSlug,
        title: item.title,
        ...(item.quantity !== undefined ? { quantity: item.quantity } : {}),
        ...(item.unit !== undefined ? { unit: item.unit } : {}),
      }),
    /**
     * An item from the grocery composer (APP-664). The draft's own key goes
     * along, so it is one item however often it is sent. `tasks.add` takes
     * none of the details: each is its own write once the item is there, and
     * `retry` writes only those that failed.
     */
    addComposedGrocery: async (
      listId: string,
      item: ComposedGrocery,
      saveKey: string,
    ): Promise<{ taskId: string } & GroceryDetails> => {
      const taskId = await add({
        listId: listId as Id<'taskLists'>,
        groupSlug,
        title: item.title,
        idempotencyKey: saveKey,
        ...(item.quantity !== undefined ? { quantity: item.quantity } : {}),
        ...(item.unit !== undefined ? { unit: item.unit } : {}),
      })
      return { taskId, ...(await groceryDetails(taskId, item)) }
    },
    /** A name onto In stock, or the staple it already is (APP-314). */
    addStaple,
    /**
     * The undo of `addStaple`: one marked running low, or added by another
     * Member, since stays.
     */
    undoStaple: (id: Id<'groceryStaples'>) =>
      removeStaple({ groupSlug, id, unlessLow: true }),
    /** A grocery list's "Maybe needed" strip on or off (APP-311). */
    setSuggestions: (listId: string, on: boolean) =>
      setSuggestions({ listId: listId as Id<'taskLists'>, groupSlug, on }),
    /** A name off a grocery list's suggestions for good, and its undo. */
    hideSuggestion: (listId: string, title: string) =>
      hideSuggestion({ listId: listId as Id<'taskLists'>, groupSlug, title }),
    unhideSuggestion: (listId: string, title: string) =>
      unhideSuggestion({ listId: listId as Id<'taskLists'>, groupSlug, title }),
    /** A step of a task, on its list and in its section (APP-304). */
    addSubtask: (
      parent: Pick<Task, 'id' | 'listId'>,
      title: string,
    ): Promise<unknown> =>
      external.has(parent.listId)
        ? write(parent.listId, { kind: 'create', title, parentId: parent.id })
        : add({
            listId: parent.listId as Id<'taskLists'>,
            groupSlug,
            title,
            parentTaskId: parent.id as Id<'tasks'>,
          }),
    /** A task's subtasks in their new order; every one, once. */
    reorderSubtasks: (parentId: string, ids: string[]) =>
      reorderSubtasks({
        taskId: parentId as Id<'tasks'>,
        groupSlug,
        ids: ids as Id<'tasks'>[],
      }),
    /** The Member responsible, or nobody (APP-302). */
    setAssignee: (id: string, userId: string | null) =>
      patch(id, { assigneeId: userId as Id<'users'> | null }),
    /** The assignee opened a task someone gave them: its notice is seen. */
    markAssignmentSeen: (id: string) =>
      markSeen({ taskId: id as Id<'tasks'>, groupSlug }),
  }
}

/**
 * The Current Group's Recent (APP-310): its grocery lists' checked items,
 * newest first, one per name, at most 100. `undefined` until Convex answers.
 */
export function useRecentGroceries() {
  const { group } = useGroup()
  return useQuery(api.tasks.recentGroceries, { groupSlug: group.slug })
}

const HOUR_MS = 60 * 60_000

/** The start of the hour `now` falls in. */
export function hourOf(now: number): number {
  return now - (now % HOUR_MS)
}

/**
 * The start of the current hour, moving on at each hour while mounted: often
 * enough for a strip measured in days, rare enough that every phone of the
 * Group asks the server the same question within the hour.
 */
function useHourClock(): number {
  const [hour, setHour] = useState(() => hourOf(Date.now()))
  useEffect(() => {
    const timer = setTimeout(
      () => setHour(hourOf(Date.now())),
      hour + HOUR_MS - Date.now(),
    )
    return () => clearTimeout(timer)
  }, [hour])
  return hour
}

type GroceryHabits = FunctionReturnType<typeof api.tasks.groceryHabits>

/**
 * What the Current Group usually buys, for one grocery list (APP-311): its
 * habits, most bought first, for the composer, and the "Maybe needed"
 * suggestions, computed on the server from the hour it is, so the strip moves
 * on while the list stays open (APP-427). `undefined` until Convex first
 * answers for this list; on the hour, the last answer stays until the next.
 */
export function useGroceryHabits(listId: string): GroceryHabits | undefined {
  const { group } = useGroup()
  const now = useHourClock()
  const live = useQuery(api.tasks.groceryHabits, {
    groupSlug: group.slug,
    listId: listId as Id<'taskLists'>,
    now,
  })
  const last = useRef<{ key: string; value: GroceryHabits } | null>(null)
  const key = `${group.slug}:${listId}`
  if (live !== undefined) last.current = { key, value: live }
  return live ?? (last.current?.key === key ? last.current.value : undefined)
}
