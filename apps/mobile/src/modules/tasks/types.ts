import type { TaskProviderId } from '@gather/core/domain'

export type Priority = 1 | 2 | 3 | 4

export interface ListDisplay {
  due: boolean
  priority: boolean
  labels: boolean
}

/**
 * Where a list's tasks stand. A local list is `live` once Convex has answered;
 * a linked one is `synced` after its provider answered, and `reconnect` or
 * `failed` when it did not, with the last rows still shown (ADR-0021).
 */
export type ListSync = 'live' | 'loading' | 'synced' | 'reconnect' | 'failed'

export interface TaskList {
  id: string
  name: string
  provider: TaskProviderId
  writable: boolean
  display: ListDisplay
  order: number
  sync: ListSync
}

export interface Task {
  id: string
  listId: string
  title: string
  done: boolean
  dueDate?: string
  priority?: Priority
  labels: string[]
  notes?: string
  order: number
}

export const SUGGESTED_LABELS = ['house', 'admin', 'car', 'inbox', 'errand']
