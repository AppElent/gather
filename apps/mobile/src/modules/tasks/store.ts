import { useAction, useMutation, useQueries, useQuery } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'

import { api } from '../../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../../convex/_generated/dataModel'
import { useGroup } from '../../group/GroupProvider'
import { toIso } from './taskDates'
import type {
  ListDisplay,
  Note,
  Priority,
  Task,
  TaskList,
  TaskState,
} from './types'

type ActionRefs = {
  toggle: (id: string) => Promise<unknown>
  add: (listId: string, title: string) => Promise<unknown>
  rename: (id: string, title: string) => Promise<unknown>
  due: (id: string, value: string | undefined) => Promise<unknown>
  priority: (id: string, value: Priority | undefined) => Promise<unknown>
  labels: (id: string, value: string[]) => Promise<unknown>
  notes: (id: string, value: string) => Promise<unknown>
  remove: (id: string) => Promise<unknown>
  moveTask: (id: string, listId: string) => Promise<unknown>
  reorder: (listId: string, ids: string[]) => Promise<unknown>
  display: (listId: string, value: ListDisplay) => Promise<unknown>
  renameList: (id: string, name: string) => Promise<unknown>
  removeList: (id: string) => Promise<unknown>
  addNote: () => Promise<string>
  editNote: (
    id: string,
    patch: { title?: string; body?: string },
  ) => Promise<unknown>
  togglePin: (id: string) => Promise<unknown>
  deleteNote: (id: string) => Promise<unknown>
  renameLabel: (from: string, to: string) => Promise<unknown>
  removeLabel: (label: string) => Promise<unknown>
}

let actions: ActionRefs | null = null

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

export function useTaskState(): TaskState {
  const { group } = useGroup()
  const listsQuery = useQuery(api.taskLists.list, { groupSlug: group.slug })
  const notesQuery = useQuery(api.notes.list, { groupSlug: group.slug })
  const getTasks = useAction(api.taskLists.getTasks)
  const [externalTasks, setExternalTasks] = useState<Task[]>([])
  const externalListIds = (listsQuery ?? [])
    .filter((list) => list.provider !== 'local')
    .map((list) => list._id)
    .join(',')
  const localQueries = useMemo(
    () => localTaskQueries(listsQuery ?? [], group.slug),
    [listsQuery, group.slug],
  )
  const taskQueries = useQueries(localQueries)

  useEffect(() => {
    let active = true
    const externalIds = externalListIds ? externalListIds.split(',') : []
    if (externalIds.length === 0) {
      setExternalTasks((current) => (current.length === 0 ? current : []))
      return () => {
        active = false
      }
    }
    void Promise.all(
      externalIds.map(async (listId) => {
        const result = await getTasks({
          listId: listId as Id<'taskLists'>,
          groupSlug: group.slug,
        })
        if (result.status !== 'ok') return []
        return result.tasks.map((task, order) => ({
          id: task.externalId,
          listId,
          title: task.title,
          done: task.done,
          dueDate: task.dueDate,
          priority: task.priority,
          labels: task.labels ?? [],
          order,
        }))
      }),
    ).then((rows) => {
      if (active) setExternalTasks(rows.flat())
    })
    return () => {
      active = false
    }
  }, [externalListIds, getTasks, group.slug])

  const add = useMutation(api.tasks.add)
  const toggle = useMutation(api.tasks.toggleDone)
  const update = useMutation(api.tasks.update)
  const remove = useMutation(api.tasks.remove)
  const reorder = useMutation(api.tasks.reorder)
  const updateDisplay = useMutation(api.taskLists.updateDisplay)
  const renameList = useMutation(api.taskLists.rename)
  const removeList = useMutation(api.taskLists.remove)
  const createNote = useMutation(api.notes.create)
  const updateNote = useMutation(api.notes.update)
  const removeNote = useMutation(api.notes.remove)
  const renameLabel = useMutation(api.tasks.renameLabel)
  const removeLabel = useMutation(api.tasks.removeLabel)

  actions = {
    toggle: (id) =>
      toggle({ taskId: id as Id<'tasks'>, groupSlug: group.slug }),
    add: (listId, title) =>
      add({ listId: listId as Id<'taskLists'>, groupSlug: group.slug, title }),
    rename: (id, title) =>
      update({ taskId: id as Id<'tasks'>, groupSlug: group.slug, title }),
    due: (id, value) =>
      update({
        taskId: id as Id<'tasks'>,
        groupSlug: group.slug,
        dueDate: value ?? null,
      }),
    priority: (id, value) =>
      update({
        taskId: id as Id<'tasks'>,
        groupSlug: group.slug,
        priority: value ?? null,
      }),
    labels: (id, value) =>
      update({
        taskId: id as Id<'tasks'>,
        groupSlug: group.slug,
        labels: value,
      }),
    notes: (id, value) =>
      update({
        taskId: id as Id<'tasks'>,
        groupSlug: group.slug,
        notes: value,
      }),
    remove: (id) =>
      remove({ taskId: id as Id<'tasks'>, groupSlug: group.slug }),
    moveTask: async () => undefined,
    reorder: (listId, ids) =>
      reorder({
        listId: listId as Id<'taskLists'>,
        groupSlug: group.slug,
        ids: ids as Id<'tasks'>[],
      }),
    display: (listId, value) =>
      updateDisplay({
        listId: listId as Id<'taskLists'>,
        groupSlug: group.slug,
        display: value,
      }),
    renameList: (id, name) =>
      renameList({
        listId: id as Id<'taskLists'>,
        groupSlug: group.slug,
        name,
      }),
    removeList: (id) =>
      removeList({ listId: id as Id<'taskLists'>, groupSlug: group.slug }),
    addNote: async () =>
      await createNote({ groupSlug: group.slug, title: '', body: '' }),
    editNote: (id, patch) =>
      updateNote({
        noteId: id as Id<'notes'>,
        groupSlug: group.slug,
        ...patch,
      }),
    togglePin: (id) =>
      updateNote({
        noteId: id as Id<'notes'>,
        groupSlug: group.slug,
        pinned: !(notesQuery?.find((note) => note._id === id)?.pinned ?? false),
      }),
    deleteNote: (id) =>
      removeNote({ noteId: id as Id<'notes'>, groupSlug: group.slug }),
    renameLabel: (from, to) => renameLabel({ groupSlug: group.slug, from, to }),
    removeLabel: (label) => removeLabel({ groupSlug: group.slug, label }),
  }

  const tasks = useMemo<Task[]>(
    () => [
      ...(
        Object.values(taskQueries) as Array<Doc<'tasks'>[] | undefined>
      ).flatMap((rows) =>
        (rows ?? []).map((task) => ({
          id: task._id,
          listId: task.listId,
          title: task.title,
          done: task.done,
          dueDate: task.dueDate,
          priority: task.priority,
          labels: task.labels ?? [],
          notes: task.notes,
          order: task.order,
        })),
      ),
      ...externalTasks,
    ],
    [externalTasks, taskQueries],
  )
  const lists: TaskList[] = (listsQuery ?? []).map((list) => ({
    id: list._id,
    name: list.name,
    provider: list.provider,
    writable: list.writable,
    display: list.display,
    order: list.order ?? 0,
  }))
  const notes: Note[] = (notesQuery ?? []).map((note) => ({
    id: note._id,
    title: note.title,
    body: note.body,
    pinned: note.pinned ?? false,
    updatedAt: note.updatedAt,
    updatedBy: note.createdBy,
  }))
  return { today: toIso(new Date()), lists, tasks, notes }
}

function requireActions(): ActionRefs {
  if (!actions)
    throw new Error('Task actions are unavailable outside a task screen')
  return actions
}

export const taskActions = {
  toggleTask: (id: string) => requireActions().toggle(id),
  addTask: (listId: string, title: string) =>
    requireActions().add(listId, title),
  renameTask: (id: string, title: string) => requireActions().rename(id, title),
  setDue: (id: string, value: string | undefined) =>
    requireActions().due(id, value),
  setPriority: (id: string, value: Priority | undefined) =>
    requireActions().priority(id, value),
  setLabels: (id: string, value: string[]) =>
    requireActions().labels(id, value),
  setNotes: (id: string, value: string) => requireActions().notes(id, value),
  deleteTask: (id: string) => requireActions().remove(id),
  moveTask: (id: string, listId: string) =>
    requireActions().moveTask(id, listId),
  reorderTasks: (listId: string, ids: string[]) =>
    requireActions().reorder(listId, ids),
  setListDisplay: (listId: string, value: Partial<ListDisplay>) => {
    const list = requireActions()
    return list.display(listId, {
      due: false,
      priority: false,
      labels: false,
      ...value,
    })
  },
  renameList: (id: string, name: string) =>
    requireActions().renameList(id, name),
  deleteList: (id: string) => requireActions().removeList(id),
  addNote: () => requireActions().addNote(),
  editNote: (id: string, patch: { title?: string; body?: string }) =>
    requireActions().editNote(id, patch),
  togglePin: (id: string) => requireActions().togglePin(id),
  deleteNote: (id: string) => requireActions().deleteNote(id),
  renameLabel: (from: string, to: string) =>
    requireActions().renameLabel(from, to),
  removeLabel: (label: string) => requireActions().removeLabel(label),
}
