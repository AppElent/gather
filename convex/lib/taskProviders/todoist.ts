import {
  ProviderAuthError,
  type TaskProviderAdapter,
  type UnifiedTask,
} from './types'

const TODOIST_API = 'https://api.todoist.com/rest/v2'

async function todoistRequest(
  accessToken: string,
  path: string,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const res = await fetchImpl(`${TODOIST_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 401 || res.status === 403) {
    throw new ProviderAuthError('todoist')
  }
  if (!res.ok) throw new Error(`Todoist API error (${res.status})`)
  return await res.json()
}

export interface TodoistApiTask {
  id: string
  content: string
  due?: { date: string } | null
  priority: 1 | 2 | 3 | 4 // API: 4 = most urgent (UI "p1")
  labels?: string[]
  url?: string
}

export function mapTodoistTask(t: TodoistApiTask): UnifiedTask {
  return {
    externalId: t.id,
    // The REST API only returns active tasks, so every row here is open.
    title: t.content,
    done: false,
    dueDate: t.due?.date?.slice(0, 10),
    priority: (5 - t.priority) as 1 | 2 | 3 | 4,
    labels: t.labels?.length ? t.labels : undefined,
    url: t.url,
  }
}

export const todoistAdapter: TaskProviderAdapter = {
  id: 'todoist',
  capabilities: { write: false, priority: true, labels: true },

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

  async fetchTasks(accessToken, config, fetchImpl = fetch) {
    const tasks = (await todoistRequest(
      accessToken,
      `/tasks?project_id=${encodeURIComponent(config.sourceId)}`,
      fetchImpl,
    )) as TodoistApiTask[]
    return tasks.map(mapTodoistTask)
  },
}
