import {
  LOCAL_CAPABILITIES,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderRequestError,
  type TaskInput,
  type TaskProviderAdapter,
  type UnifiedTask,
} from './types'

const TODOIST_API = 'https://api.todoist.com/rest/v2'
const TODOIST_SYNC_API = 'https://api.todoist.com/sync/v9'

/** How many completed tasks a refresh is willing to carry back per list. */
const COMPLETED_LIMIT = 50

/**
 * Turn a response into the error it is, before anything reads its body.
 *
 * Three of them mean different things to the caller and so are different
 * types: a rejected token asks for a reconnect, a rate limit asks for
 * patience, and a refusal is about this request. Lumping them together is what
 * produces "something went wrong" in the UI.
 */
function assertOk(res: Response): void {
  if (res.status === 401 || res.status === 403) {
    throw new ProviderAuthError('todoist')
  }
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After'))
    throw new ProviderRateLimitError(
      'todoist',
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    )
  }
  if (!res.ok) throw new ProviderRequestError('todoist', res.status)
}

async function todoistRequest(
  accessToken: string,
  path: string,
  fetchImpl: typeof fetch,
  init?: RequestInit & { body?: string },
): Promise<unknown> {
  const res = await fetchImpl(`${TODOIST_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  assertOk(res)
  // 204 on close/reopen/delete: nothing to read, and reading it throws.
  if (res.status === 204) return null
  return await res.json()
}

/**
 * The Sync API's own GET endpoints — `completed/get_all` among them, which is
 * the only place a finished task can still be read from.
 */
async function todoistCompletedRequest(
  accessToken: string,
  path: string,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const res = await fetchImpl(`${TODOIST_SYNC_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  assertOk(res)
  return await res.json()
}

/**
 * The Sync API's command endpoint, which is where the things REST v2 has no
 * endpoint for live — the signed-in user among them.
 */
async function todoistSyncRequest(
  accessToken: string,
  body: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const res = await fetchImpl(`${TODOIST_SYNC_API}/sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  })
  assertOk(res)
  return await res.json()
}

export interface TodoistApiTask {
  id: string
  content: string
  due?: { date: string } | null
  priority: 1 | 2 | 3 | 4 // API: 4 = most urgent (UI "p1")
  labels?: string[]
  url?: string
  parent_id?: string | null
}

/** One entry of the Sync API's completed list, which is a different shape. */
export interface TodoistCompletedItem {
  task_id: string
  content: string
  completed_at?: string
}

export function mapTodoistTask(t: TodoistApiTask): UnifiedTask {
  return {
    externalId: t.id,
    // `/tasks` returns active tasks only; completed ones come back from the
    // Sync API below, already marked done.
    title: t.content,
    done: false,
    dueDate: t.due?.date?.slice(0, 10),
    priority: (5 - t.priority) as 1 | 2 | 3 | 4,
    labels: t.labels?.length ? t.labels : undefined,
    url: t.url,
    parentExternalId: t.parent_id ?? undefined,
  }
}

/**
 * A completed task, as much of it as Todoist still reports.
 *
 * The completed record carries the title and nothing else — no priority, no
 * labels, no due date. Those are not dropped by gather; they are what the
 * provider has to say about a finished task, and the provider is
 * authoritative (ADR-0013).
 */
export function mapTodoistCompleted(item: TodoistCompletedItem): UnifiedTask {
  return {
    externalId: String(item.task_id),
    title: item.content,
    done: true,
  }
}

/** UI priority (1 = most urgent) is Todoist's upside down. */
function toTodoistPriority(priority: 1 | 2 | 3 | 4): number {
  return 5 - priority
}

/**
 * A write, as Todoist's REST body.
 *
 * `undefined` fields are left out entirely — mentioning a field at all is how
 * Todoist is told to change it, so "leave it alone" has to mean silence.
 * `null` is the clear, which for a date is a phrase rather than an absence.
 */
function toTodoistBody(input: TaskInput): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (input.title !== undefined) body.content = input.title
  // Only on create: REST v2 will not reparent through an update, which is what
  // `moveTask` and the Sync API are for.
  if (input.parentExternalId) body.parent_id = input.parentExternalId
  if (input.dueDate !== undefined) {
    if (input.dueDate === null) body.due_string = 'no date'
    else body.due_date = input.dueDate
  }
  if (input.priority !== undefined) {
    // Todoist has no "no priority"; its lowest is p4, which is what an
    // unprioritised task already is there.
    body.priority = input.priority === null ? 1 : toTodoistPriority(input.priority)
  }
  if (input.labels !== undefined) body.labels = input.labels ?? []
  return body
}

export const todoistAdapter: TaskProviderAdapter = {
  id: 'todoist',
  // Writable, save for ordering: a Todoist project's order is Todoist's, and
  // gather does not offer to rearrange somebody else's project (ADR-0014).
  capabilities: {
    ...LOCAL_CAPABILITIES,
    reorder: false,
    subtasks: true,
    // Todoist nests four levels deep and refuses the fifth. The limit lives
    // here rather than in the Module, so the Module never has to know whose
    // limit it is (ADR-0014).
    maxDepth: 4,
  },

  async getAccountIdentity(accessToken, fetchImpl = fetch) {
    const data = (await todoistSyncRequest(
      accessToken,
      { sync_token: '*', resource_types: '["user"]' },
      fetchImpl,
    )) as { user?: { id?: string; email?: string; full_name?: string } }
    const user = data.user
    if (!user?.id) throw new Error('Todoist did not identify the account')
    return {
      externalAccountId: String(user.id),
      // The email, because a household connecting two Todoist accounts is
      // choosing between two people — "Todoist" twice tells them nothing.
      accountLabel: user.email ?? user.full_name ?? 'Todoist',
    }
  },

  async listAvailableSources(accessToken, fetchImpl = fetch) {
    const projects = (await todoistRequest(
      accessToken,
      '/projects',
      fetchImpl,
    )) as Array<{ id: string; name: string }>
    return projects.map((p) => ({ id: p.id, name: p.name }))
  },

  async getSourceSchema() {
    // Todoist's task shape is fixed — there is nothing to map.
    return []
  },

  /**
   * The project's tasks: the open ones, then the finished ones.
   *
   * Both, because a task that can be completed has to be reopenable, and
   * Todoist drops a completed task out of `/tasks` entirely — a list that
   * fetched only the active ones would make completing something look exactly
   * like deleting it.
   */
  async fetchTasks(accessToken, config, fetchImpl = fetch) {
    const project = encodeURIComponent(config.sourceId)
    const active = (await todoistRequest(
      accessToken,
      `/tasks?project_id=${project}`,
      fetchImpl,
    )) as TodoistApiTask[]

    const completed = (await todoistCompletedRequest(
      accessToken,
      `/completed/get_all?project_id=${project}&limit=${COMPLETED_LIMIT}`,
      fetchImpl,
    )) as { items?: TodoistCompletedItem[] }

    // Open first, finished after — the order the Tasks Module reads a list in
    // anyway, so the cache's own ordering needs no second opinion.
    return [
      ...active.map(mapTodoistTask),
      ...(completed.items ?? []).map(mapTodoistCompleted),
    ]
  },

  async createTask(accessToken, config, input, fetchImpl = fetch) {
    const created = (await todoistRequest(
      accessToken,
      '/tasks',
      fetchImpl,
      {
        method: 'POST',
        body: JSON.stringify({
          ...toTodoistBody(input),
          project_id: config.sourceId,
        }),
      },
    )) as TodoistApiTask
    return mapTodoistTask(created)
  },

  async updateTask(accessToken, _config, externalId, input, fetchImpl = fetch) {
    const updated = (await todoistRequest(
      accessToken,
      `/tasks/${encodeURIComponent(externalId)}`,
      fetchImpl,
      { method: 'POST', body: JSON.stringify(toTodoistBody(input)) },
    )) as TodoistApiTask
    return mapTodoistTask(updated)
  },

  async setDone(accessToken, _config, externalId, done, fetchImpl = fetch) {
    await todoistRequest(
      accessToken,
      `/tasks/${encodeURIComponent(externalId)}/${done ? 'close' : 'reopen'}`,
      fetchImpl,
      { method: 'POST' },
    )
  },

  async deleteTask(accessToken, _config, externalId, fetchImpl = fetch) {
    await todoistRequest(
      accessToken,
      `/tasks/${encodeURIComponent(externalId)}`,
      fetchImpl,
      { method: 'DELETE' },
    )
  },

  /**
   * Reparent, through the Sync API's `item_move` command.
   *
   * REST v2 has no way to do this — its update endpoint ignores `parent_id` —
   * so a task's place in the hierarchy is the one write that has to go through
   * the other API. Moving to the top level means naming the project instead of
   * a parent, which is what Todoist wants and not an omission.
   */
  async moveTask(
    accessToken,
    config,
    externalId,
    parentExternalId,
    fetchImpl = fetch,
  ) {
    const args = parentExternalId
      ? { id: externalId, parent_id: parentExternalId }
      : { id: externalId, project_id: config.sourceId }
    const result = (await todoistSyncRequest(
      accessToken,
      {
        commands: JSON.stringify([
          { type: 'item_move', uuid: crypto.randomUUID(), args },
        ]),
      },
      fetchImpl,
    )) as { sync_status?: Record<string, unknown> }

    // The Sync API answers 200 with a per-command status, so a refusal here is
    // not an HTTP error and would otherwise pass for success.
    const status = Object.values(result.sync_status ?? {})[0]
    if (status !== undefined && status !== 'ok') {
      throw new ProviderRequestError('todoist', 400)
    }
  },
}
