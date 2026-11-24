/**
 * What the view tools return, shared by the tools (Worker) and the views (the
 * iframe bundle). Plain JSON only.
 */

export const VIEW_NAMES = ['week-agenda', 'task-list', 'recipe-card'] as const
export type ViewName = (typeof VIEW_NAMES)[number]

export function viewUri(view: ViewName) {
  return `ui://gather/${view}`
}

export type AgendaEvent = {
  id: string
  calendar: string
  title: string
  date: string
  allDay: boolean
  /** Local HH:MM; absent on an all-day event. */
  start?: string
  end?: string
  location?: string
}

export type WeekAgendaResult = {
  view: 'week-agenda'
  groupId: string
  groupName: string
  /** Monday, YYYY-MM-DD. */
  weekStart: string
  previousWeekStart: string
  nextWeekStart: string
  /** The week holding today in the Group's zone (UTC when it has none). */
  isCurrentWeek: boolean
  today: string
  /** The Group's zone; absent: the view highlights the viewer's own day. */
  timeZone?: string
  days: { date: string; events: AgendaEvent[] }[]
  /** More events than the view shows; list_events reads them all. */
  truncated: boolean
}

export type ListTask = {
  id: string
  title: string
  done: boolean
  dueDate?: string
  priority?: 1 | 2 | 3 | 4
  labels?: string[]
}

export type TaskListResult = {
  view: 'task-list'
  groupId: string
  groupName: string
  listId: string
  listName: string
  /** The Group's zone; absent: overdue goes by the viewer's own day. */
  timeZone?: string
  /** The token has gather:write and the list is kept in Gather. */
  canWrite: boolean
  /** Why the view cannot write, when it cannot. */
  readOnlyReason?: 'scope' | 'external'
  tasks: ListTask[]
}

export type RecipeCardResult = {
  view: 'recipe-card'
  groupId: string
  groupName: string
  recipe: {
    id: string
    title: string
    description?: string
    imageUrl?: string
    ingredients: string[]
    steps: string[]
    tags: string[]
    servings?: number
    prepMinutes?: number
    rating?: number
    sourceUrl?: string
    /** The Group it was shared from, when it lives elsewhere. */
    sharedFrom?: string
  }
}

export type ViewResult = WeekAgendaResult | TaskListResult | RecipeCardResult
