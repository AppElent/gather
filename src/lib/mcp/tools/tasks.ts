import {
  GROCERY_AISLES,
  GROCERY_QUANTITY_MAX,
  GROCERY_UNITS,
} from '@gather/core/groceries'
import {
  REPEAT_EVERY_MAX,
  REPEAT_MODES,
  REPEAT_UNITS,
} from '@gather/core/task-repeat'
import { z } from 'zod'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import {
  asId,
  defineTool,
  groupSlug,
  publicDoc,
  type ToolContext,
  ToolInputError,
} from './define'
import { day, groupId, idempotencyKey } from './shared'

const priority = z
  .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
  .describe('1 is the highest priority, 4 the lowest')
const labels = z.array(z.string().min(1).max(40)).max(20)

// A grocery item's amount (APP-309). Only lists with grocery true keep them;
// any other list writes the amount into the title instead.
const quantity = z
  .number()
  .positive()
  .max(GROCERY_QUANTITY_MAX)
  .describe(
    'How much of a grocery item, for example 2 for "2 pakken melk". Kept to three decimals.',
  )
const unit = z
  .enum(GROCERY_UNITS)
  .describe(
    'The unit of quantity, in Dutch: stuks (pieces), pak, fles, pot, zak, blik, g, kg, ml, l and so on. Leave it out for a plain count.',
  )
const category = z
  .enum(GROCERY_AISLES)
  .describe(
    'The supermarket aisle of a grocery item. Gather sets it from the name; setting it moves the item and is remembered for the Group.',
  )

// How a task repeats (APP-303). Gather fills weekdays, monthDay and month
// from the due date when they are left out.
const repeat = z
  .object({
    mode: z
      .enum(REPEAT_MODES)
      .describe(
        'fixed: on a schedule (bins every Tuesday). afterDone: a set time after it was last done (descale 3 months after).',
      ),
    unit: z
      .enum(REPEAT_UNITS)
      .describe('day, week, month or year. afterDone takes day, week or month.'),
    every: z
      .number()
      .int()
      .min(1)
      .max(REPEAT_EVERY_MAX)
      .describe('Every N units: 2 with week is every other week.'),
    weekdays: z
      .array(z.number().int().min(1).max(7))
      .min(1)
      .max(7)
      .optional()
      .describe(
        'fixed weekly only: the days, 1 Monday to 7 Sunday. Defaults to the weekday of the due date.',
      ),
    monthDay: z
      .number()
      .int()
      .min(1)
      .max(31)
      .optional()
      .describe(
        'fixed monthly or yearly: the day of the month. Months without it use their last day. Defaults to the due date.',
      ),
    month: z
      .number()
      .int()
      .min(1)
      .max(12)
      .optional()
      .describe('fixed yearly: the month, 1 to 12. Defaults to the due date.'),
  })
  .describe(
    'How the task repeats. A repeating task has one open occurrence: marking it done moves dueDate to the next one and keeps it open.',
  )

// The Member responsible for a task (APP-302). People are named, never
// numbered, through MCP, so the tools take and give a Member's name.
const assignee = z
  .string()
  .min(1)
  .max(100)
  .describe(
    'Who is responsible for the task: the name of a current Member of the Group, from members in list_task_lists. Giving a task to someone else notifies them.',
  )

// A subtask's parent (APP-304): one level deep, on the same list.
const parentTaskId = z
  .string()
  .min(1)
  .describe(
    'Makes this a subtask of that task: a task on the same list that is not a subtask itself (one level deep). A subtask has its own done, dueDate and assignee but cannot repeat; it reopens when its repeating parent moves on.',
  )

function membersOf(context: ToolContext, slug: string) {
  return context.backend.query(api.groups.members, { slug })
}

/** The one current Member with this name; anything else is refused here. */
async function assigneeIdOf(
  context: ToolContext,
  slug: string,
  name: string,
): Promise<Id<'users'>> {
  const wanted = name.trim().toLocaleLowerCase()
  const found = (await membersOf(context, slug)).filter(
    (member) => member.name.trim().toLocaleLowerCase() === wanted,
  )
  if (found.length === 1) return found[0].userId
  throw new ToolInputError(
    found.length > 1
      ? `More than one Member of this Group is called ${name}.`
      : `Nobody called ${name} is a Member of this Group. Use a name from members in list_task_lists.`,
  )
}

export const taskTools = [
  defineTool({
    name: 'list_task_lists',
    title: 'List task lists',
    description:
      "List a Group's task lists. Only lists with writable true are kept in Gather; the others mirror Notion or Todoist and their tasks are not available here. Lists with grocery true are grocery lists: their tasks carry quantity, unit and an aisle category. members are the names a task can be assigned to.",
    access: 'read',
    input: { groupId },
    async run({ groupId }, context) {
      const slug = await groupSlug(context, groupId)
      const [lists, members] = await Promise.all([
        context.backend.query(api.taskLists.list, { groupSlug: slug }),
        membersOf(context, slug),
      ])
      return {
        members: members.map((member) => member.name),
        lists: lists.map((l) =>
          publicDoc({
            _id: l._id,
            name: l.name,
            provider: l.provider,
            writable: l.writable,
            kind: l.kind,
            grocery: l.grocery,
          }),
        ),
      }
    },
  }),
  defineTool({
    name: 'list_tasks',
    title: 'List tasks',
    description:
      'List the tasks on one of a Group\'s task lists, open tasks first in list order. Done tasks are left out unless includeDone is true. assignee is the name of the Member responsible, when there is one. parentTaskId marks a subtask: the _id of the task it is a step of.',
    access: 'read',
    input: {
      groupId,
      listId: z.string().min(1),
      includeDone: z.boolean().default(false),
    },
    async run({ groupId, listId, includeDone }, context) {
      const slug = await groupSlug(context, groupId)
      const tasks = await context.backend.query(api.tasks.listByList, {
        groupSlug: slug,
        listId: asId<'taskLists'>(listId),
      })
      const names = tasks.some((t) => t.assigneeId)
        ? new Map(
            (await membersOf(context, slug)).map((m) => [m.userId, m.name]),
          )
        : new Map<string, string>()
      return {
        tasks: tasks
          .filter((t) => includeDone || !t.done)
          .map((t) =>
            publicDoc({
              _id: t._id,
              title: t.title,
              done: t.done,
              dueDate: t.dueDate,
              priority: t.priority,
              labels: t.labels,
              notes: t.notes,
              quantity: t.quantity,
              unit: t.unit,
              category: t.category,
              repeat: t.repeat,
              assignee: t.assigneeId ? names.get(t.assigneeId) : undefined,
              parentTaskId: t.parentTaskId,
            }),
          ),
      }
    },
  }),
  defineTool({
    name: 'create_task_list',
    title: 'Create task list',
    description: 'Add a new task list, kept in Gather, to a Group.',
    access: 'write',
    input: { groupId, idempotencyKey, name: z.string().min(1).max(100) },
    async run({ groupId, idempotencyKey, name }, context) {
      const id = await context.backend.mutation(api.taskLists.create, {
        groupSlug: await groupSlug(context, groupId),
        name,
        provider: 'local',
        idempotencyKey,
      })
      return { listId: id }
    },
  }),
  defineTool({
    name: 'create_task',
    title: 'Create task',
    description:
      'Add a task to the end of a task list. The list must be writable (see list_task_lists). On a grocery list, put the amount in quantity and unit and only the product in title: "2 pakken melk" is title "melk", quantity 2, unit "pak". The aisle is set from the name. A task with repeat on a fixed schedule and no dueDate starts on its first scheduled day. assignee names the Member responsible. parentTaskId adds it as a subtask of another task on the same list.',
    access: 'write',
    input: {
      groupId,
      listId: z.string().min(1),
      idempotencyKey,
      title: z.string().min(1).max(500),
      dueDate: day.optional(),
      priority: priority.optional(),
      labels: labels.optional(),
      quantity: quantity.optional(),
      unit: unit.optional(),
      repeat: repeat.optional(),
      assignee: assignee.optional(),
      parentTaskId: parentTaskId.optional(),
    },
    async run(
      { groupId, listId, assignee, parentTaskId, ...input },
      context,
    ) {
      const slug = await groupSlug(context, groupId)
      const id = await context.backend.mutation(api.tasks.add, {
        groupSlug: slug,
        listId: asId<'taskLists'>(listId),
        ...input,
        ...(parentTaskId === undefined
          ? {}
          : { parentTaskId: asId<'tasks'>(parentTaskId) }),
        ...(assignee === undefined
          ? {}
          : { assigneeId: await assigneeIdOf(context, slug, assignee) }),
      })
      return { taskId: id }
    },
  }),
  defineTool({
    name: 'update_task',
    title: 'Update task',
    description:
      'Change a task, or mark it done or open again. Only the fields you pass change; dueDate, priority, labels, notes, quantity, unit, repeat or assignee set to null are cleared. quantity, unit and category apply to grocery lists only and are ignored on other lists. On a repeating task, done true completes the open occurrence: dueDate moves to the next one and the task stays open. Pass occurrence, the dueDate you read, so a retry does not complete it twice. done true leaves the open subtasks of the task open unless withSubtasks is true. parentTaskId makes it a subtask of another task on the same list; null makes it a task of its own again.',
    access: 'write',
    // Not idempotent: done true on a repeating task without occurrence
    // completes it again on every retry.
    annotations: { idempotentHint: false },
    input: {
      groupId,
      taskId: z.string().min(1),
      title: z.string().min(1).max(500).optional(),
      done: z.boolean().optional(),
      dueDate: day.nullable().optional(),
      priority: priority.nullable().optional(),
      labels: labels.nullable().optional(),
      notes: z.string().max(5000).nullable().optional(),
      quantity: quantity.nullable().optional(),
      unit: unit.nullable().optional(),
      category: category.optional(),
      repeat: repeat.nullable().optional(),
      occurrence: day
        .nullable()
        .optional()
        .describe(
          'With done true on a repeating task: its dueDate as you read it (null if it had none). When the task has moved on since, nothing is completed again.',
        ),
      assignee: assignee.nullable().optional(),
      parentTaskId: parentTaskId.nullable().optional(),
      withSubtasks: z
        .boolean()
        .optional()
        .describe(
          "With done true: mark the task's open subtasks done too. Left out, they stay open.",
        ),
    },
    async run(
      { groupId, taskId, assignee, parentTaskId, ...changes },
      context,
    ) {
      const slug = await groupSlug(context, groupId)
      const completed = await context.backend.mutation(api.tasks.update, {
        groupSlug: slug,
        taskId: asId<'tasks'>(taskId),
        ...changes,
        ...(parentTaskId === undefined
          ? {}
          : {
              parentTaskId:
                parentTaskId === null ? null : asId<'tasks'>(parentTaskId),
            }),
        ...(assignee === undefined
          ? {}
          : {
              assigneeId:
                assignee === null
                  ? null
                  : await assigneeIdOf(context, slug, assignee),
            }),
      })
      return completed
        ? { taskId, updated: true, nextDueDate: completed.dueDate }
        : { taskId, updated: true }
    },
  }),
]
