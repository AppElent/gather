import { todayIn } from '@gather/core/civil-date'
import {
  externalSnapshot,
  type LinkedTaskWrite,
  writeLinkedTask,
} from '@gather/core/linked-lists'
import { subtasksOf } from '@gather/core/subtasks'
import type { TaskListColor, TaskListIcon } from '@gather/core/task-lists'
import {
  type ListDisplay,
  type Priority,
  type Task,
  type TaskList,
  taskFromRow,
  toggled,
  toggledRows,
} from '@gather/core/task-model'
import type { QuickAdd } from '@gather/core/task-quick-add'
import type { ReminderClock } from '@gather/core/task-reminders'
import type { TaskRepeat } from '@gather/core/task-repeat'
import { deviceTimeZone } from '@gather/core/time-zones'
import type { OptimisticLocalStore } from 'convex/browser'
import { useAction, useConvex, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'

/** A task as a write names it: a linked one by its own list. */
type TaskRef = Pick<Task, 'id'> & Partial<Pick<Task, 'listId' | 'linked'>>

const linkedListOf = (task: TaskRef) => (task.linked ? task.listId : undefined)

/** Ticks a task in every cached query that holds it, as the server will. */
function toggleInPlace(
  store: OptimisticLocalStore,
  {
    taskId,
    today,
    withSubtasks,
  }: { taskId: Id<'tasks'>; today?: string; withSubtasks?: boolean },
) {
  for (const { args, value } of store.getAllQueries(api.tasks.listByList)) {
    if (!value?.some((task) => task._id === taskId)) continue
    store.setQuery(
      api.tasks.listByList,
      args,
      toggledRows(value, taskId, today, withSubtasks),
    )
  }
  // A smart list holds open tasks only (APP-301).
  for (const { args, value } of store.getAllQueries(api.tasks.smartLists)) {
    const target = value?.tasks.find((task) => task._id === taskId)
    if (!value || !target) continue
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

/** Every write Tasks makes on the web, in the Current Group. */
export function useTaskActions() {
  const { slug: groupSlug, timeZone } = useRequiredCurrentGroup()
  const add = useMutation(api.tasks.add)
  const toggle = useMutation(api.tasks.toggleDone).withOptimisticUpdate(
    toggleInPlace,
  )
  const update = useMutation(api.tasks.update)
  const remove = useMutation(api.tasks.remove)
  const moveToList = useMutation(api.tasks.moveToList)
  const reorder = useMutation(api.tasks.reorder)
  const undoCompletion = useMutation(api.tasks.undoCompletion)
  const setDoneInList = useMutation(api.tasks.setDoneInList)
  const markSeen = useMutation(api.tasks.markAssignmentSeen)
  const reorderSubtasks = useMutation(api.tasks.reorderSubtasks)
  const setReminder = useMutation(api.tasks.setReminder)
  const setSection = useMutation(api.tasks.setSection)
  const renameLabel = useMutation(api.tasks.renameLabel)
  const removeLabel = useMutation(api.tasks.removeLabel)
  const updateDisplay = useMutation(api.taskLists.updateDisplay)
  const renameList = useMutation(api.taskLists.rename)
  const removeList = useMutation(api.taskLists.remove)
  const setAppearance = useMutation(api.taskLists.setAppearance)
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
        sendWrite({ listId: id as Id<'taskLists'>, groupSlug, write: sent }),
      (id) => getTasks({ listId: id as Id<'taskLists'>, groupSlug }),
      () => convex.connectionState().isWebSocketConnected,
    )

  const patch = (
    id: string,
    fields: Omit<Parameters<typeof update>[0], 'taskId' | 'groupSlug'>,
  ) => update({ taskId: id as Id<'tasks'>, groupSlug, ...fields })

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

  return {
    /**
     * A quick-add line onto a list (APP-307). A typed time becomes the
     * caller's reminder once the task exists; the task stays if that fails.
     */
    addParsed: async (
      listId: string,
      parsed: QuickAdd,
      saveKey: string,
      options: { assigneeId?: string; sectionId?: string } = {},
    ): Promise<{ reminderFailed: boolean }> => {
      if (externalSnapshot().has(listId)) {
        await write(listId, {
          kind: 'create',
          title: parsed.title,
          requestKey: saveKey,
          ...(parsed.dueDate ? { dueDate: parsed.dueDate } : {}),
          ...(parsed.labels.length > 0 ? { labels: parsed.labels } : {}),
        })
        return { reminderFailed: false }
      }
      const assigneeId = parsed.assigneeId ?? options.assigneeId
      const taskId = await add({
        listId: listId as Id<'taskLists'>,
        groupSlug,
        title: parsed.title,
        today: todayIn(timeZone),
        idempotencyKey: saveKey,
        ...(parsed.dueDate ? { dueDate: parsed.dueDate } : {}),
        ...(parsed.repeat ? { repeat: parsed.repeat } : {}),
        ...(assigneeId ? { assigneeId: assigneeId as Id<'users'> } : {}),
        ...(parsed.labels.length > 0 ? { labels: parsed.labels } : {}),
        ...(options.sectionId ? { sectionId: options.sectionId } : {}),
      })
      if (!parsed.time || !parsed.dueDate) return { reminderFailed: false }
      try {
        await setReminder({
          taskId,
          groupSlug,
          reminder: {
            date: parsed.dueDate,
            time: parsed.time,
            timeZone: deviceTimeZone(),
          },
        })
        return { reminderFailed: false }
      } catch {
        return { reminderFailed: true }
      }
    },
    /** A local task again, with its note and its open subtasks. */
    duplicate: async (
      task: Task,
      title: string,
      saveKey: string,
    ) => {
      const listId = task.listId as Id<'taskLists'>
      // Read before anything is written: a page may show only some of them.
      const subtasks = subtasksOf(
        (await convex.query(api.tasks.listByList, { listId, groupSlug })).map(
          taskFromRow,
        ),
        task.id,
      )
      const taskId = await add({
        listId,
        groupSlug,
        title,
        today: todayIn(timeZone),
        idempotencyKey: saveKey,
        ...(task.dueDate ? { dueDate: task.dueDate } : {}),
        ...(task.priority ? { priority: task.priority } : {}),
        ...(task.labels.length > 0 ? { labels: task.labels } : {}),
        ...(task.repeat ? { repeat: task.repeat } : {}),
        ...(task.assigneeId
          ? { assigneeId: task.assigneeId as Id<'users'> }
          : {}),
        ...(task.sectionId ? { sectionId: task.sectionId } : {}),
      })
      const details = {
        ...(task.notes ? { notes: task.notes } : {}),
        ...(task.url ? { url: task.url } : {}),
        ...(task.priceCents !== undefined
          ? { priceCents: task.priceCents }
          : {}),
      }
      if (Object.keys(details).length > 0) await patch(taskId, details)
      // One after another, so they keep their order.
      for (const subtask of subtasks) {
        await add({
          listId,
          groupSlug,
          title: subtask.title,
          parentTaskId: taskId,
        })
      }
      return taskId as string
    },
    /** Ticks a task, or completes a repeating one's open occurrence. */
    toggleTask: async (
      task: TaskRef,
      options: { withSubtasks?: boolean } = {},
    ) => {
      const linkedId = linkedListOf(task)
      const withSubtasks = options.withSubtasks ? { withSubtasks: true } : {}
      if (linkedId) {
        const row = externalSnapshot()
          .get(linkedId)
          ?.tasks.find((each) => each.id === task.id)
        await write(linkedId, {
          kind: 'setDone',
          taskId: task.id,
          done: !row?.done,
          ...withSubtasks,
        })
        return null
      }
      return toggle({
        taskId: task.id as Id<'tasks'>,
        groupSlug,
        today: todayIn(timeZone),
        ...withSubtasks,
      })
    },
    undoCompletion: (completionId: Id<'taskCompletions'>) =>
      undoCompletion({ completionId, groupSlug }),
    rename: (task: TaskRef, title: string) => edit(task, { title }),
    setDue: (task: TaskRef, value: string | undefined) =>
      edit(task, { dueDate: value ?? null }),
    setPriority: (task: TaskRef, value: Priority | undefined) =>
      edit(task, { priority: value ?? null }),
    setLabels: (task: TaskRef, labels: string[]) => edit(task, { labels }),
    /** A rule, or null for no repeat; the server anchors it on the date. */
    setRepeat: (id: string, repeat: TaskRepeat | null) =>
      patch(id, { repeat, today: todayIn(timeZone) }),
    setNotes: (id: string, notes: string) => patch(id, { notes }),
    setUrl: (id: string, url: string | null) => patch(id, { url }),
    setPrice: (id: string, priceCents: number | null) =>
      patch(id, { priceCents }),
    setAssignee: (id: string, userId: string | null) =>
      patch(id, { assigneeId: userId as Id<'users'> | null }),
    /** A reminder for the caller at this wall clock, or none (APP-305). */
    setReminder: (id: string, clock: ReminderClock | null) =>
      setReminder({ taskId: id as Id<'tasks'>, groupSlug, reminder: clock }),
    markAssignmentSeen: (id: string) =>
      markSeen({ taskId: id as Id<'tasks'>, groupSlug }),
    remove: (id: string) => remove({ taskId: id as Id<'tasks'>, groupSlug }),
    moveToList: (id: string, listId: string) =>
      moveToList({
        taskId: id as Id<'tasks'>,
        groupSlug,
        listId: listId as Id<'taskLists'>,
      }),
    /** A linked task under another on its list, or out of it with null. */
    moveUnder: (task: Pick<Task, 'id' | 'listId'>, parentId: string | null) =>
      write(task.listId, { kind: 'move', taskId: task.id, parentId }),
    setTaskSection: (id: string, sectionId: string | null) =>
      setSection({ taskId: id as Id<'tasks'>, groupSlug, sectionId }),
    reorder: (listId: string, ids: string[], sectionIds?: (string | null)[]) =>
      reorder({
        listId: listId as Id<'taskLists'>,
        groupSlug,
        ids: ids as Id<'tasks'>[],
        ...(sectionIds ? { sectionIds } : {}),
      }),
    addSubtask: (
      parent: Pick<Task, 'id' | 'listId'>,
      title: string,
    ): Promise<unknown> =>
      externalSnapshot().has(parent.listId)
        ? write(parent.listId, { kind: 'create', title, parentId: parent.id })
        : add({
            listId: parent.listId as Id<'taskLists'>,
            groupSlug,
            title,
            parentTaskId: parent.id as Id<'tasks'>,
          }),
    reorderSubtasks: (parentId: string, ids: string[]) =>
      reorderSubtasks({
        taskId: parentId as Id<'tasks'>,
        groupSlug,
        ids: ids as Id<'tasks'>[],
      }),
    /** Every item on a list, or only `ids`, checked or unchecked at once. */
    setDoneInList: (listId: string, done: boolean, ids?: string[]) =>
      setDoneInList({
        listId: listId as Id<'taskLists'>,
        groupSlug,
        done,
        taskIds: ids as Id<'tasks'>[] | undefined,
      }),
    renameLabel: (from: string, to: string) =>
      renameLabel({ groupSlug, from, to }),
    removeLabel: (label: string) => removeLabel({ groupSlug, label }),
    setListDisplay: (list: TaskList, change: Partial<ListDisplay>) =>
      updateDisplay({
        listId: list.id as Id<'taskLists'>,
        groupSlug,
        display: { ...list.display, ...change },
      }),
    renameList: (id: string, name: string) =>
      renameList({ listId: id as Id<'taskLists'>, groupSlug, name }),
    removeList: (id: string) =>
      removeList({ listId: id as Id<'taskLists'>, groupSlug }),
    setListAppearance: (
      id: string,
      face: { icon?: TaskListIcon; color?: TaskListColor },
    ) => setAppearance({ listId: id as Id<'taskLists'>, groupSlug, ...face }),
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
    removeSection: (listId: string, sectionId: string) =>
      removeSection({
        listId: listId as Id<'taskLists'>,
        groupSlug,
        sectionId,
      }),
  }
}

export type TaskActions = ReturnType<typeof useTaskActions>
