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
import {
  type GroceryAisle,
  type GroceryUnit,
  groceryAddFields,
} from '@gather/core/groceries'
import {
  asTaskListKind,
  type TaskListColor,
  type TaskListIcon,
  type TaskListKind,
  taskListFace,
} from '@gather/core/task-lists'
import type { ReminderClock } from '@gather/core/task-reminders'
import { nextDueDate, type TaskRepeat } from '@gather/core/task-repeat'
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
      repeatText: task.repeatText,
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
      grocery: list.grocery ?? false,
      checkedClearedAt: list.checkedClearedAt ?? null,
      sections: list.sections ?? [],
      ...listFace(list),
    }
  })
  return { lists: views, tasks }
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
  { taskId, today }: { taskId: Id<'tasks'>; today?: string },
) {
  for (const { args, value } of store.getAllQueries(api.tasks.listByList)) {
    if (!value?.some((task) => task._id === taskId)) continue
    store.setQuery(
      api.tasks.listByList,
      args,
      value.map((task) => {
        if (task._id !== taskId) return task
        if (task.repeat && !task.done && today) {
          return {
            ...task,
            dueDate: nextDueDate(task.repeat, { dueDate: task.dueDate, today }),
          }
        }
        return {
          ...task,
          done: !task.done,
          // As the server stamps it, so a fresh check is not taken for
          // one from before the last "Clear checked" (APP-310).
          doneAt: task.done ? undefined : Date.now(),
        }
      }),
    )
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
  const createList = useMutation(api.taskLists.create)
  const setAppearance = useMutation(api.taskLists.setAppearance)
  const setDoneInList = useMutation(api.tasks.setDoneInList)
  const undoCompletion = useMutation(api.tasks.undoCompletion)
  const clearChecked = useMutation(api.taskLists.clearCheckedUndoable)
  const restoreCheckedCleared = useMutation(api.taskLists.restoreCheckedCleared)
  const putBack = useMutation(api.tasks.putBack)
  const markSeen = useMutation(api.tasks.markAssignmentSeen)
  const setReminder = useMutation(api.tasks.setReminder)
  const setSection = useMutation(api.tasks.setSection)
  const addSection = useMutation(api.taskSections.add)
  const renameSection = useMutation(api.taskSections.rename)
  const reorderSections = useMutation(api.taskSections.reorder)
  const removeSection = useMutation(api.taskSections.remove)

  const patch = (
    id: string,
    fields: Omit<Parameters<typeof update>[0], 'taskId' | 'groupSlug'>,
  ) => update({ taskId: id as Id<'tasks'>, groupSlug, ...fields })

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
     * Ticks a task, or completes a repeating one's open occurrence. The
     * phone's own day goes along, so "after done" counts from it.
     */
    toggleTask: async (task: Pick<Task, 'id' | 'title'>) => {
      const completion = await toggle({
        taskId: task.id as Id<'tasks'>,
        groupSlug,
        today: localIsoDate(),
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
    }) => createList({ groupSlug, provider: 'local', ...fields }),
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
    /** A grocery item's amount and unit; null clears either (APP-309). */
    setAmount: (
      id: string,
      quantity: number | null,
      unit: GroceryUnit | null,
    ) => patch(id, { quantity, unit }),
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
    /** A Recent item back onto a grocery list, with its amount and aisle. */
    putBack: (taskId: string, listId: string) =>
      putBack({
        taskId: taskId as Id<'tasks'>,
        listId: listId as Id<'taskLists'>,
        groupSlug,
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
