export type Provider = 'local' | 'notion' | 'todoist'
export type Priority = 1 | 2 | 3 | 4

export interface ListDisplay {
  due: boolean
  priority: boolean
  labels: boolean
}

export interface TaskList {
  id: string
  name: string
  provider: Provider
  writable: boolean
  display: ListDisplay
  order: number
}

export type List = TaskList

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

export interface Note {
  id: string
  title: string
  body: string
  pinned: boolean
  updatedAt: number
  updatedBy: string
}

export interface TaskState {
  today: string
  lists: TaskList[]
  tasks: Task[]
  notes: Note[]
}

export const SUGGESTED_LABELS = ['house', 'admin', 'car', 'inbox', 'errand']
