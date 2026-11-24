import {
  ProviderAuthError,
  ProviderTaskNotFoundError,
  type SourceConfig,
  type TaskFieldChanges,
  type TaskProviderAdapter,
  type TaskProviderWriter,
  type UnifiedTask,
  type WriteOutcome,
} from './types'

const TODOIST_API = 'https://api.todoist.com/api/v1'
const PAGE_SIZE = '200'
/** The completed-task endpoint answers at most three months. */
const COMPLETED_WINDOW_MS = 89 * 24 * 60 * 60_000

interface TodoistDue {
  date: string
  is_recurring?: boolean
  string?: string
  lang?: string
  /** Set on a due time in a fixed zone, whose `date` is then in UTC. */
  timezone?: string | null
}

export interface TodoistApiTask {
  id: string
  content: string
  due?: TodoistDue | null
  priority: 1 | 2 | 3 | 4 // API: 4 = most urgent (UI "p1")
  labels?: string[]
  url?: string
  project_id?: string
  section_id?: string | null
  /** Whether it is completed; absent or false on an active task. */
  checked?: boolean
  /** The task this one is a subtask of; null or absent at the top. */
  parent_id?: string | null
}

class TodoistHttpError extends Error {
  constructor(readonly status: number) {
    super(`Todoist API error (${status})`)
  }
}

function errorTag(body: string): string | undefined {
  try {
    const tag: unknown = JSON.parse(body)?.error_tag
    return typeof tag === 'string' ? tag : undefined
  } catch {
    return undefined
  }
}

/**
 * Whether reconnecting is the answer. A 403 is what a write on an old
 * `data:read` connection gets, and also, under another tag, what a full project
 * or a task this person may not change gets, which reconnecting does not help.
 */
function isAuthRefusal(status: number | undefined, tag?: string): boolean {
  return status === 401 || (status === 403 && (!tag || tag.startsWith('AUTH_')))
}

async function todoistRequest<T>(
  accessToken: string,
  path: string,
  fetchImpl: typeof fetch,
  init: {
    method?: 'POST'
    json?: unknown
    form?: Record<string, string>
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  }
  let body: string | undefined
  if (init.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(init.json)
  } else if (init.form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    body = new URLSearchParams(init.form).toString()
  }
  const res = await fetchImpl(`${TODOIST_API}${path}`, {
    method: init.method ?? 'GET',
    headers,
    ...(body === undefined ? {} : { body }),
  })
  const text = await res.text()
  if (!res.ok) {
    if (isAuthRefusal(res.status, errorTag(text))) {
      throw new ProviderAuthError('todoist')
    }
    throw new TodoistHttpError(res.status)
  }
  return (text ? JSON.parse(text) : null) as T
}

/** Every row of a paginated endpoint. */
async function allPages<T>(
  accessToken: string,
  path: string,
  params: Record<string, string>,
  rowsKey: 'results' | 'items',
  fetchImpl: typeof fetch,
): Promise<T[]> {
  const rows: T[] = []
  let cursor: string | null = null
  do {
    const query = new URLSearchParams({ ...params, limit: PAGE_SIZE })
    if (cursor) query.set('cursor', cursor)
    const page: { next_cursor?: string | null } & Partial<
      Record<'results' | 'items', T[]>
    > = await todoistRequest(accessToken, `${path}?${query}`, fetchImpl)
    rows.push(...(page[rowsKey] ?? []))
    cursor = page.next_cursor ?? null
  } while (cursor)
  return rows
}

/** An instant's civil date and time in a zone, as `YYYY-MM-DDTHH:MM:SS`. */
function wallClock(at: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(at)
      .map(({ type, value }) => [type, value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
}

/** The day a due date falls on, in its own zone when it has a fixed one. */
function dueDay(due: TodoistDue): string {
  if (due.timezone && due.date.endsWith('Z')) {
    return wallClock(new Date(due.date), due.timezone).slice(0, 10)
  }
  return due.date.slice(0, 10)
}

/** The same due, with its time and repeat, on another day. */
export function dueOnDay(due: TodoistDue, day: string): TodoistDue {
  // A one-off due's own words ("nov 24") would be read again over the date.
  const { is_recurring, string, lang, timezone } = due
  const kept = {
    ...(is_recurring ? { is_recurring, string, lang } : {}),
    ...(timezone ? { timezone } : {}),
  }
  if (!(timezone && due.date.endsWith('Z'))) {
    return { ...kept, date: day + due.date.slice(10) }
  }
  const wall = wallClock(new Date(due.date), timezone)
  const wanted = Date.parse(`${day}${wall.slice(10)}Z`)
  // Two passes land on the wall clock also across a clock change.
  let at = wanted
  for (let pass = 0; pass < 2; pass++) {
    at += wanted - Date.parse(`${wallClock(new Date(at), timezone)}Z`)
  }
  return { ...kept, date: new Date(at).toISOString().replace('.000Z', 'Z') }
}

export function mapTodoistTask(t: TodoistApiTask): UnifiedTask {
  return {
    externalId: t.id,
    title: t.content,
    done: t.checked ?? false,
    dueDate: t.due?.date ? dueDay(t.due) : undefined,
    priority: (5 - t.priority) as 1 | 2 | 3 | 4,
    labels: t.labels?.length ? t.labels : undefined,
    url: t.url ?? `https://app.todoist.com/app/task/${encodeURIComponent(t.id)}`,
    repeatText: t.due?.is_recurring && t.due.string ? t.due.string : undefined,
    parentExternalId: t.parent_id ?? undefined,
  }
}

/**
 * The project's API v1 id. A list linked before v1 stores the numeric id the
 * retired REST v2 used, which v1 refuses (docs/migrations/README.md).
 */
async function projectIdOf(
  accessToken: string,
  config: SourceConfig,
  fetchImpl: typeof fetch,
): Promise<string> {
  if (!/^\d+$/.test(config.sourceId)) return config.sourceId
  const found = await todoistRequest<{ old_id: string; new_id: string }[]>(
    accessToken,
    `/id_mappings/projects/${config.sourceId}`,
    fetchImpl,
  )
  return (
    found.find((each) => each.old_id === config.sourceId)?.new_id ??
    config.sourceId
  )
}

function taskPath(taskId: string, suffix = ''): string {
  return `/tasks/${encodeURIComponent(taskId)}${suffix}`
}

/** A task by id, or null when Todoist has none open under it. */
async function getTask(
  accessToken: string,
  taskId: string,
  fetchImpl: typeof fetch,
): Promise<TodoistApiTask | null> {
  try {
    return await todoistRequest<TodoistApiTask>(
      accessToken,
      taskPath(taskId),
      fetchImpl,
    )
  } catch (error) {
    if (error instanceof TodoistHttpError && error.status === 404) return null
    throw error
  }
}

/**
 * The task, only if it is in the project: a connection reaches its whole
 * Todoist account, and a list reaches one project of it.
 */
async function requireTask(
  accessToken: string,
  projectId: string,
  taskId: string,
  fetchImpl: typeof fetch,
): Promise<TodoistApiTask> {
  const task = await getTask(accessToken, taskId, fetchImpl)
  if (task?.project_id === projectId) return task
  // Elsewhere in the account is answered like missing.
  if (task) throw new ProviderTaskNotFoundError('todoist')
  const now = Date.now()
  const completed = await allPages<TodoistApiTask>(
    accessToken,
    '/tasks/completed/by_completion_date',
    {
      project_id: projectId,
      since: new Date(now - COMPLETED_WINDOW_MS).toISOString(),
      until: new Date(now + 60_000).toISOString(),
    },
    'items',
    fetchImpl,
  )
  const found = completed.find((each) => each.id === taskId)
  if (!found) throw new ProviderTaskNotFoundError('todoist')
  return { ...found, checked: true }
}

interface SyncCommand {
  type: string
  uuid: string
  temp_id?: string
  args: Record<string, unknown>
}

/** Sync API commands in one request; any one refused is the whole failing. */
async function sync(
  accessToken: string,
  commands: SyncCommand[],
  fetchImpl: typeof fetch,
): Promise<Record<string, string>> {
  const answer = await todoistRequest<{
    sync_status?: Record<
      string,
      'ok' | { http_code?: number; error_tag?: string }
    >
    temp_id_mapping?: Record<string, string>
  }>(accessToken, '/sync', fetchImpl, {
    method: 'POST',
    form: { commands: JSON.stringify(commands) },
  })
  for (const { uuid } of commands) {
    const status = answer.sync_status?.[uuid]
    if (status === 'ok') continue
    const refusal = typeof status === 'object' ? status : {}
    const { http_code: code, error_tag: tag } = refusal
    if (isAuthRefusal(code, tag)) throw new ProviderAuthError('todoist')
    if (code === 404 || tag === 'ITEM_NOT_FOUND') throw new ProviderTaskNotFoundError('todoist')
    throw new Error(`Todoist refused a change (${code ?? 'no status'})`)
  }
  return answer.temp_id_mapping ?? {}
}

/** One UUID per key and project: Todoist runs a command's UUID once. */
async function uuidOf(key: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(key),
  )
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

const apiPriority = (priority: 1 | 2 | 3 | 4) => 5 - priority

/**
 * Reads back what an accepted write left. A failed read must not say the write
 * failed, so it only asks for a refresh.
 */
async function readBack(
  accessToken: string,
  taskId: string,
  fetchImpl: typeof fetch,
): Promise<WriteOutcome> {
  try {
    const task = await getTask(accessToken, taskId, fetchImpl)
    if (task) return { tasks: [mapTodoistTask(task)], refresh: false }
  } catch {
    // Falls through: saved, not read.
  }
  return { tasks: [], refresh: true }
}

/** Maps a 404 on the task itself to "not found". */
async function onTask<T>(run: Promise<T>): Promise<T> {
  try {
    return await run
  } catch (error) {
    if (error instanceof TodoistHttpError && error.status === 404) {
      throw new ProviderTaskNotFoundError('todoist')
    }
    throw error
  }
}

const writer: TaskProviderWriter = {
  async createTask(accessToken, config, task, fetchImpl = fetch) {
    const projectId = await projectIdOf(accessToken, config, fetchImpl)
    if (task.parentId) {
      const parent = await requireTask(
        accessToken,
        projectId,
        task.parentId,
        fetchImpl,
      )
      if (parent.checked) throw new ProviderTaskNotFoundError('todoist')
    }
    const uuid = task.requestKey
      ? await uuidOf(`${projectId}:${task.requestKey}`)
      : crypto.randomUUID()
    // Sync rather than REST: its UUID is Todoist's documented retry key.
    const ids = await sync(
      accessToken,
      [
        {
          type: 'item_add',
          uuid,
          temp_id: uuid,
          args: {
            content: task.title,
            project_id: projectId,
            ...(task.parentId ? { parent_id: task.parentId } : {}),
            ...(task.dueDate ? { due: { date: task.dueDate } } : {}),
            ...(task.priority ? { priority: apiPriority(task.priority) } : {}),
            ...(task.labels?.length ? { labels: task.labels } : {}),
          },
        },
      ],
      fetchImpl,
    )
    // A repeated command may be answered without the id it made.
    if (!ids[uuid]) return { tasks: [], refresh: true }
    return await readBack(accessToken, ids[uuid], fetchImpl)
  },

  async updateTask(accessToken, config, taskId, changes, fetchImpl = fetch) {
    const projectId = await projectIdOf(accessToken, config, fetchImpl)
    const task = await requireTask(accessToken, projectId, taskId, fetchImpl)
    const args = updateArgs(task, changes)
    // Sync rather than REST: REST's `due_date` would drop a repeat or a time,
    // and one command cannot half-apply.
    await sync(
      accessToken,
      [
        {
          type: 'item_update',
          uuid: crypto.randomUUID(),
          args: { id: task.id, ...args },
        },
      ],
      fetchImpl,
    )
    return await readBack(accessToken, task.id, fetchImpl)
  },

  async closeTask(accessToken, config, taskId, options, fetchImpl = fetch) {
    const projectId = await projectIdOf(accessToken, config, fetchImpl)
    const task = await requireTask(accessToken, projectId, taskId, fetchImpl)
    if (!task.due?.is_recurring) {
      // Todoist completes an ordinary task's subtasks with it.
      await onTask(
        todoistRequest(accessToken, taskPath(task.id, '/close'), fetchImpl, {
          method: 'POST',
        }),
      )
      return { tasks: [], refresh: false }
    }
    // A recurring one only moves to its next date and leaves its subtasks.
    // Subtasks go first, so that one refused leaves the task where it was: a
    // retry must not move it on twice.
    const close = (tasks: TodoistApiTask[]) =>
      sync(
        accessToken,
        tasks.map(({ id }) => ({
          type: 'item_close',
          uuid: crypto.randomUUID(),
          args: { id },
        })),
        fetchImpl,
      )
    const children = options.withSubtasks
      ? await allPages<TodoistApiTask>(
          accessToken,
          '/tasks',
          { parent_id: task.id },
          'results',
          fetchImpl,
        )
      : []
    if (children.length > 0) await close(children)
    await close([task])
    const outcome = await readBack(accessToken, task.id, fetchImpl)
    return { ...outcome, refresh: true }
  },

  async reopenTask(accessToken, config, taskId, fetchImpl = fetch) {
    const projectId = await projectIdOf(accessToken, config, fetchImpl)
    const task = await requireTask(accessToken, projectId, taskId, fetchImpl)
    await onTask(
      todoistRequest(accessToken, taskPath(task.id, '/reopen'), fetchImpl, {
        method: 'POST',
      }),
    )
    return await readBack(accessToken, task.id, fetchImpl)
  },

  async moveTask(accessToken, config, taskId, parentId, fetchImpl = fetch) {
    const projectId = await projectIdOf(accessToken, config, fetchImpl)
    const task = await requireTask(accessToken, projectId, taskId, fetchImpl)
    if (parentId) {
      const parent = await requireTask(
        accessToken,
        projectId,
        parentId,
        fetchImpl,
      )
      if (parent.checked) throw new ProviderTaskNotFoundError('todoist')
    }
    const moved = await onTask(
      todoistRequest<TodoistApiTask>(
        accessToken,
        taskPath(task.id, '/move'),
        fetchImpl,
        {
          method: 'POST',
          json: parentId
            ? { parent_id: parentId }
            : // Out of its parent, and still in its section.
              task.section_id
              ? { section_id: task.section_id }
              : { project_id: projectId },
        },
      ),
    )
    return { tasks: [mapTodoistTask(moved)], refresh: false }
  },
}

/** A change as `item_update` takes it, keeping a due's repeat and time. */
function updateArgs(
  task: TodoistApiTask,
  changes: TaskFieldChanges,
): Record<string, unknown> {
  const args: Record<string, unknown> = {}
  if (changes.title !== undefined) args.content = changes.title
  if (changes.dueDate !== undefined) {
    args.due =
      changes.dueDate === null
        ? null
        : task.due
          ? dueOnDay(task.due, changes.dueDate)
          : { date: changes.dueDate }
  }
  if (changes.priority !== undefined) {
    // Todoist has no "none": its lowest is what a task without one has.
    args.priority = changes.priority === null ? 1 : apiPriority(changes.priority)
  }
  if (changes.labels !== undefined) args.labels = changes.labels
  return args
}

export const todoistAdapter: TaskProviderAdapter = {
  id: 'todoist',
  capabilities: { write: true },
  writer,

  async listAvailableSources(accessToken, fetchImpl = fetch) {
    const projects = await allPages<{ id: string; name: string }>(
      accessToken,
      '/projects',
      {},
      'results',
      fetchImpl,
    )
    return projects.map((p) => ({ id: p.id, name: p.name }))
  },

  async getSourceSchema() {
    // Todoist's task shape is fixed — there is nothing to map.
    return []
  },

  async fetchTasks(accessToken, config, fetchImpl = fetch) {
    const projectId = await projectIdOf(accessToken, config, fetchImpl)
    const tasks = await allPages<TodoistApiTask>(
      accessToken,
      '/tasks',
      { project_id: projectId },
      'results',
      fetchImpl,
    )
    return tasks.map(mapTodoistTask)
  },
}
