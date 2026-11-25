/**
 * Tasks' reads on the web (APP-308), the phone's `store.ts` in this app's
 * terms: local rows are Convex subscriptions, a linked list's rows are the
 * last answer kept in `@gather/core/linked-lists` (ADR-0021: fetched on first
 * open, then when someone asks).
 */
import { initialsForPeople } from '@gather/core/calendar'
import { todayIn } from '@gather/core/civil-date'
import {
  ensureExternalLists,
  externalSnapshot,
  subscribeExternal,
  syncExternalList,
} from '@gather/core/linked-lists'
import {
  indexModel,
  type ListRow,
  linkedHomeOf,
  listView,
  type SmartLists,
  smartModel,
  type Task,
  type TaskList,
  taskFromRow,
  withProgress,
} from '@gather/core/task-model'
import { useAction, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'

export type TaskListRow = FunctionReturnType<typeof api.taskLists.list>[number]
type TaskDoc = FunctionReturnType<typeof api.tasks.listByList>[number]

const NO_LISTS: readonly TaskListRow[] = []

function useExternal() {
  return useSyncExternalStore(
    subscribeExternal,
    externalSnapshot,
    externalSnapshot,
  )
}

/** The Current Group's calendar day: its time zone decides, never the browser's. */
export function useGroupToday(): string {
  const { timeZone } = useRequiredCurrentGroup()
  return todayIn(timeZone)
}

/** The Current Group's lists, without their tasks. */
export function useTaskLists(): readonly TaskListRow[] | undefined {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  return useQuery(api.taskLists.list, { groupSlug })
}

/** The linked lists' last answers, each asked for once when first seen. */
function useLinkedLists(lists: readonly ListRow[]) {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const linked = useExternal()
  const getTasks = useAction(api.taskLists.getTasks)
  const fetchTasks = useCallback(
    (listId: string) =>
      getTasks({ listId: listId as Id<'taskLists'>, groupSlug }),
    [getTasks, groupSlug],
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

/** One list's tasks, local or linked. `tasks` is undefined while they load. */
function useRowsOf(row: TaskListRow | undefined) {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const local = row?.provider === 'local'
  const docs = useQuery(
    api.tasks.listByList,
    row && local ? { listId: row._id, groupSlug } : 'skip',
  )
  const only = useMemo(() => (row ? [row] : NO_LISTS), [row])
  const { linked, refresh } = useLinkedLists(only)
  const entry = row && !local ? linked.get(row._id) : undefined
  return useMemo(() => {
    const list: TaskList | undefined = row
      ? listView(
          row,
          local ? (docs ? 'live' : 'loading') : (entry?.sync ?? 'loading'),
          entry,
        )
      : undefined
    const rows = local
      ? docs?.map(taskFromRow)
      : entry && !(entry.sync === 'loading' && entry.tasks.length === 0)
        ? entry.tasks
        : undefined
    const tasks = rows
      ? withProgress(rows).sort((a, b) => a.order - b.order)
      : undefined
    return { list, tasks, docs: local ? docs : undefined, refresh }
  }, [row, local, docs, entry, refresh])
}

/** A list by id. `status` is `missing` once the Group's lists do not hold it. */
export function useTaskList(listId: string) {
  const today = useGroupToday()
  const lists = useTaskLists()
  const row = lists?.find((list) => list._id === listId)
  const { list, tasks, refresh } = useRowsOf(row)
  return {
    status:
      lists === undefined ? 'loading' : row === undefined ? 'missing' : 'ready',
    today,
    list,
    tasks,
    refresh: () => refresh(listId),
  } as const
}

export type TaskState =
  | { status: 'loading' }
  /** `deleted`: it was here a moment ago; otherwise the address is wrong. */
  | { status: 'missing'; deleted: boolean }
  | {
      status: 'ready'
      task: Task
      list: TaskList
      /** Every task on its list, for subtasks and parents. */
      tasks: Task[]
      /** Its Convex row; a linked task has none. */
      doc?: TaskDoc
    }

/**
 * One task wherever it is now. A linked one is found in its list's last
 * answer, any other is placed by `tasks.listOf`. Only a task neither knows
 * asks the Group's linked lists, as opening them would. One project can be
 * linked to two lists, so a linked task stays with `openedFrom`, the list it
 * was opened from (APP-799).
 */
export function useTaskOf(
  taskId: string | undefined,
  openedFrom?: string,
): TaskState {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const lists = useTaskLists()
  const external = useExternal()
  const opened = lists?.find(
    (list) => list._id === openedFrom && list.provider !== 'local',
  )?._id
  const linkedHome = taskId
    ? (opened ?? linkedHomeOf(lists, external, taskId))
    : undefined
  const localHome = useQuery(
    api.tasks.listOf,
    !taskId || linkedHome ? 'skip' : { groupSlug, taskId },
  )
  const unknown = Boolean(taskId) && !linkedHome && localHome === null
  const asked = useMemo(
    () =>
      unknown
        ? (lists ?? NO_LISTS).filter((list) => list.provider !== 'local')
        : NO_LISTS,
    [unknown, lists],
  )
  useLinkedLists(asked)
  const home = linkedHome ?? localHome ?? undefined
  const { list, tasks, docs } = useRowsOf(
    lists?.find((each) => each._id === home),
  )
  const seen = useRef<string | undefined>(undefined)

  if (!taskId) return { status: 'missing', deleted: false }
  const missing = {
    status: 'missing',
    deleted: seen.current === taskId,
  } as const
  if (lists === undefined) return { status: 'loading' }
  if (!home) {
    if (localHome === undefined) return { status: 'loading' }
    const pending = asked.some((each) => {
      const sync = external.get(each._id)?.sync
      return sync === undefined || sync === 'loading'
    })
    return pending ? { status: 'loading' } : missing
  }
  if (!list || !tasks) return { status: 'loading' }
  const task = tasks.find((each) => each.id === taskId)
  if (!task) return missing
  seen.current = taskId
  const doc = docs?.find((each) => each._id === taskId)
  return { status: 'ready', task, list, tasks, doc }
}

/** The index: every list and how many tasks each holds, never their rows. */
export function useTaskIndex() {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const lists = useTaskLists()
  const answer = useQuery(api.tasks.openCounts, { groupSlug })
  const { linked } = useLinkedLists(lists ?? NO_LISTS)
  return useMemo(
    () => ({
      loaded: lists !== undefined,
      ...indexModel(lists, answer, linked),
    }),
    [lists, answer, linked],
  )
}

/** The Current Group's four smart lists (APP-301). */
export function useSmartLists(): SmartLists {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const today = useGroupToday()
  const lists = useTaskLists()
  const answer = useQuery(api.tasks.smartLists, { groupSlug, today })
  const linked = useExternal()
  return useMemo(
    () => smartModel(lists, answer, linked, today),
    [lists, answer, linked, today],
  )
}

/** Every label used in the Current Group, linked lists' last rows included. */
export function useGroupLabels(): readonly string[] {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const lists = useTaskLists()
  const local = useQuery(api.tasks.labels, { groupSlug })
  const linked = useExternal()
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

export interface TaskPerson {
  id: string
  name: string
  initial: string
}

/** The Current Group's Members, each with their coin's letters. */
export function useTaskPeople(): {
  people: readonly TaskPerson[]
  byId: ReadonlyMap<string, TaskPerson>
} {
  const { slug } = useRequiredCurrentGroup()
  const members = useQuery(api.groups.members, { slug })
  return useMemo(() => {
    const people = (members ?? []).map((m) => ({
      id: m.userId as string,
      name: m.name,
    }))
    const initials = initialsForPeople(people)
    const all = people.map((person) => ({
      ...person,
      initial: initials.get(person.id) ?? '?',
    }))
    return { people: all, byId: new Map(all.map((each) => [each.id, each])) }
  }, [members])
}
