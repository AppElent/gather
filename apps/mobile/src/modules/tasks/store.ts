/**
 * Tasks' one door to the backend: what a Group's lists hold, and every write.
 *
 * Local lists are Convex subscriptions, which the query cache already shares
 * between every screen that mounts them. A linked list is not: its tasks come
 * from Notion or Todoist through an action, so the last answer for each list is
 * kept here, once for the app, and fetched again only when someone asks
 * (ADR-0021: first open, then manual refresh). A failed fetch keeps the last
 * rows readable and says so through the list's `sync`.
 */
import { localIsoDate } from '@gather/core/civil-date'
import type { OptimisticLocalStore } from 'convex/browser'
import { useAction, useMutation } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { api, type Doc, type Id } from '../../convex/api'
import { useQueries, useQuery } from '../../convex/queries'
import { useGroup } from '../../group/GroupProvider'
import type { ListDisplay, ListSync, Priority, Task, TaskList } from './types'

type ListRow = FunctionReturnType<typeof api.taskLists.list>[number]
type FetchResult = FunctionReturnType<typeof api.taskLists.getTasks>
type FetchTasks = (listId: string) => Promise<FetchResult>

interface ExternalEntry {
  sync: Exclude<ListSync, 'live'>
  tasks: Task[]
}

let external: ReadonlyMap<string, ExternalEntry> = new Map()
const inFlight = new Map<string, Promise<ListSync>>()
const listeners = new Set<() => void>()

function put(listId: string, entry: ExternalEntry) {
  external = new Map(external).set(listId, entry)
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
    tasks: result.tasks.map((task, order) => ({
      id: task.externalId,
      listId,
      title: task.title,
      done: task.done,
      dueDate: task.dueDate,
      priority: task.priority,
      labels: task.labels ?? [],
      order,
    })),
  }
}

/** Asks the provider for one list now; a second ask while one runs joins it. */
export function syncExternalList(
  listId: string,
  fetchTasks: FetchTasks,
): Promise<ListSync> {
  const running = inFlight.get(listId)
  if (running) return running
  const previous = external.get(listId)?.tasks ?? []
  put(listId, { sync: 'loading', tasks: previous })
  const run = fetchTasks(listId)
    .then(
      (result) => externalEntry(listId, result, previous),
      (): ExternalEntry => ({ sync: 'failed', tasks: previous }),
    )
    .then((entry) => {
      put(listId, entry)
      return entry.sync
    })
    .finally(() => inFlight.delete(listId))
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

/** Local rows and linked rows as one model: the only place the two meet. */
export function mergeTasks(
  lists: readonly ListRow[],
  local: Readonly<Record<string, unknown>>,
  linked: ReadonlyMap<string, ExternalEntry>,
): { lists: TaskList[]; tasks: Task[] } {
  const tasks: Task[] = []
  const views = lists.map((list): TaskList => {
    let sync: ListSync
    if (list.provider === 'local') {
      const rows = local[list._id]
      // `useQueries` hands back the Error a failed subscription threw.
      sync = Array.isArray(rows)
        ? 'live'
        : rows instanceof Error
          ? 'failed'
          : 'loading'
      if (Array.isArray(rows)) {
        for (const row of rows as Doc<'tasks'>[]) {
          tasks.push({
            id: row._id,
            listId: row.listId,
            title: row.title,
            done: row.done,
            dueDate: row.dueDate,
            priority: row.priority,
            labels: row.labels ?? [],
            notes: row.notes,
            order: row.order,
          })
        }
      }
    } else {
      const entry = linked.get(list._id)
      sync = entry?.sync ?? 'loading'
      tasks.push(...(entry?.tasks ?? []))
    }
    return {
      id: list._id,
      name: list.name,
      provider: list.provider,
      writable: list.writable,
      display: list.display,
      order: list.order,
      sync,
    }
  })
  return { lists: views, tasks }
}

export function taskSections<T extends { done: boolean }>(tasks: readonly T[]) {
  return {
    active: tasks.filter((task) => !task.done),
    completed: tasks.filter((task) => task.done),
  }
}

/** Ticks a task in every cached list that holds it, before the server agrees. */
export function toggleInPlace(
  store: OptimisticLocalStore,
  { taskId }: { taskId: Id<'tasks'> },
) {
  for (const { args, value } of store.getAllQueries(api.tasks.listByList)) {
    if (!value?.some((task) => task._id === taskId)) continue
    store.setQuery(
      api.tasks.listByList,
      args,
      value.map((task) =>
        task._id === taskId ? { ...task, done: !task.done } : task,
      ),
    )
  }
}

const NO_LISTS: readonly ListRow[] = []

function useListsOf(lists: readonly ListRow[]) {
  const { group } = useGroup()
  const localQueries = useMemo(
    () => localTaskQueries(lists, group.slug),
    [lists, group.slug],
  )
  const local = useQueries(localQueries)
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

/** Every write Tasks makes, in the Current Group. */
export function useTaskActions() {
  const { group } = useGroup()
  const groupSlug = group.slug
  const add = useMutation(api.tasks.add)
  const toggle = useMutation(api.tasks.toggleDone).withOptimisticUpdate(
    toggleInPlace,
  )
  const update = useMutation(api.tasks.update)
  const remove = useMutation(api.tasks.remove)
  const moveToList = useMutation(api.tasks.moveToList)
  const reorder = useMutation(api.tasks.reorder)
  const updateDisplay = useMutation(api.taskLists.updateDisplay)
  const renameList = useMutation(api.taskLists.rename)
  const removeList = useMutation(api.taskLists.remove)
  const renameLabel = useMutation(api.tasks.renameLabel)
  const removeLabel = useMutation(api.tasks.removeLabel)

  const patch = (
    id: string,
    fields: Omit<Parameters<typeof update>[0], 'taskId' | 'groupSlug'>,
  ) => update({ taskId: id as Id<'tasks'>, groupSlug, ...fields })

  return {
    addTask: (listId: string, title: string) =>
      add({ listId: listId as Id<'taskLists'>, groupSlug, title }),
    toggleTask: (id: string) =>
      toggle({ taskId: id as Id<'tasks'>, groupSlug }),
    renameTask: (id: string, title: string) => patch(id, { title }),
    setDue: (id: string, value: string | undefined) =>
      patch(id, { dueDate: value ?? null }),
    setPriority: (id: string, value: Priority | undefined) =>
      patch(id, { priority: value ?? null }),
    setLabels: (id: string, labels: string[]) => patch(id, { labels }),
    setNotes: (id: string, notes: string) => patch(id, { notes }),
    deleteTask: (id: string) =>
      remove({ taskId: id as Id<'tasks'>, groupSlug }),
    moveTask: (id: string, listId: string) =>
      moveToList({
        taskId: id as Id<'tasks'>,
        groupSlug,
        listId: listId as Id<'taskLists'>,
      }),
    reorderTasks: (listId: string, ids: string[]) =>
      reorder({
        listId: listId as Id<'taskLists'>,
        groupSlug,
        ids: ids as Id<'tasks'>[],
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
  }
}
