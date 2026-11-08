import { EXTERNAL_PROVIDER_IDS, TASK_PROVIDER_IDS } from '@gather/core/domain'
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
