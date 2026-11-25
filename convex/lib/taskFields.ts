import { EXTERNAL_PROVIDER_IDS, TASK_PROVIDER_IDS } from '@gather/core/domain'
import {
  TASK_LIST_COLORS,
  TASK_LIST_ICONS,
  TASK_LIST_KINDS,
} from '@gather/core/task-lists'
import { REPEAT_MODES, REPEAT_UNITS } from '@gather/core/task-repeat'
import { v } from 'convex/values'
import { literals } from './validators'

export const taskProviderValidator = literals(TASK_PROVIDER_IDS)
export const externalProviderValidator = literals(EXTERNAL_PROVIDER_IDS)

export const taskPriorityValidator = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(3),
  v.literal(4),
)

export const providerConfigValidator = v.object({
  connectionId: v.id('integrationConnections'),
  sourceId: v.string(), // Notion database id / Todoist project id
  propertyMapping: v.optional(
    v.object({
      title: v.string(),
      done: v.string(),
      dueDate: v.optional(v.string()),
      priority: v.optional(v.string()),
      labels: v.optional(v.string()),
    }),
  ),
})

export const taskListDisplayValidator = v.object({
  due: v.boolean(),
  priority: v.boolean(),
  labels: v.boolean(),
})

// What kind of list it is and the face it wears (APP-306). All three are
// optional on the table: lists made before them, and by phones that predate
// them, read as a plain list in the kind's colour and icon.
export const taskListKindValidator = literals(TASK_LIST_KINDS)
export const taskListIconValidator = literals(TASK_LIST_ICONS)
export const taskListColorValidator = literals(TASK_LIST_COLORS)

/**
 * How a task repeats (APP-303), as `@gather/core/task-repeat` defines it. The
 * shape only: ranges and which fields a unit uses are `normalizeRepeat`'s, so
 * a stored rule is always the normalized one.
 */
export const taskRepeatValidator = v.object({
  mode: literals(REPEAT_MODES),
  unit: literals(REPEAT_UNITS),
  every: v.number(),
  weekdays: v.optional(v.array(v.number())),
  monthDay: v.optional(v.number()),
  month: v.optional(v.number()),
})

/**
 * A task's reminder (APP-305): the wall clock it was set for, in the zone of
 * the phone that set it, and the one person it goes to. One per task.
 */
export const taskReminderValidator = v.object({
  date: v.string(), // YYYY-MM-DD
  time: v.string(), // HH:MM
  timeZone: v.string(), // IANA
  userId: v.id('users'),
})

/** One write to a linked list (`taskLists.writeTask`, ADR-0021). */
export const linkedTaskWriteValidator = v.union(
  v.object({
    kind: v.literal('create'),
    title: v.string(),
    parentId: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    priority: v.optional(taskPriorityValidator),
    labels: v.optional(v.array(v.string())),
    /** The same key makes one task, however often it is sent. */
    requestKey: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal('update'),
    taskId: v.string(),
    title: v.optional(v.string()),
    dueDate: v.optional(v.union(v.string(), v.null())),
    priority: v.optional(v.union(taskPriorityValidator, v.null())),
    labels: v.optional(v.array(v.string())),
    /** A Member who is in the provider's project, or nobody (APP-405). */
    assigneeId: v.optional(v.union(v.id('users'), v.null())),
  }),
  v.object({
    kind: v.literal('setDone'),
    taskId: v.string(),
    done: v.boolean(),
    /** Completes a recurring task's open subtasks with it. */
    withSubtasks: v.optional(v.boolean()),
    /**
     * With subtasks: sent again after a failure, it moves each recurring
     * subtask on once.
     */
    requestKey: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal('move'),
    taskId: v.string(),
    /** The task to go under, or null for the top of the list. */
    parentId: v.union(v.string(), v.null()),
  }),
)
