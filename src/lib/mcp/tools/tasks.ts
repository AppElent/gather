import {
  GROCERY_AISLES,
  GROCERY_QUANTITY_MAX,
  GROCERY_UNITS,
} from '@gather/core/groceries'
import { z } from 'zod'
import { api } from '../../../../convex/_generated/api'
import { asId, defineTool, groupSlug, publicDoc } from './define'
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

export const taskTools = [
  defineTool({
    name: 'list_task_lists',
    title: 'List task lists',
    description:
      "List a Group's task lists. Only lists with writable true are kept in Gather; the others mirror Notion or Todoist and their tasks are not available here. Lists with grocery true are grocery lists: their tasks carry quantity, unit and an aisle category.",
    access: 'read',
    input: { groupId },
    async run({ groupId }, context) {
      const lists = await context.backend.query(api.taskLists.list, {
        groupSlug: await groupSlug(context, groupId),
      })
      return {
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
      'List the tasks on one of a Group\'s task lists, open tasks first in list order. Done tasks are left out unless includeDone is true.',
    access: 'read',
    input: {
      groupId,
      listId: z.string().min(1),
      includeDone: z.boolean().default(false),
    },
    async run({ groupId, listId, includeDone }, context) {
      const tasks = await context.backend.query(api.tasks.listByList, {
        groupSlug: await groupSlug(context, groupId),
        listId: asId<'taskLists'>(listId),
      })
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
      'Add a task to the end of a task list. The list must be writable (see list_task_lists). On a grocery list, put the amount in quantity and unit and only the product in title: "2 pakken melk" is title "melk", quantity 2, unit "pak". The aisle is set from the name.',
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
    },
    async run({ groupId, listId, ...input }, context) {
      const id = await context.backend.mutation(api.tasks.add, {
        groupSlug: await groupSlug(context, groupId),
        listId: asId<'taskLists'>(listId),
        ...input,
      })
      return { taskId: id }
    },
  }),
  defineTool({
    name: 'update_task',
    title: 'Update task',
    description:
      'Change a task, or mark it done or open again. Only the fields you pass change; dueDate, priority, labels, notes, quantity or unit set to null are cleared. quantity, unit and category apply to grocery lists only.',
    access: 'write',
    annotations: { idempotentHint: true },
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
    },
    async run({ groupId, taskId, ...changes }, context) {
      await context.backend.mutation(api.tasks.update, {
        groupSlug: await groupSlug(context, groupId),
        taskId: asId<'tasks'>(taskId),
        ...changes,
      })
      return { taskId, updated: true }
    },
  }),
]
