import {
  type PropertyMapping,
  ProviderAuthError,
  type SourceConfig,
  type TaskProviderAdapter,
  type UnifiedTask,
} from './types'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'
const DONE_STATUS_NAMES = ['done', 'complete', 'completed']

async function notionRequest(
  accessToken: string,
  path: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const res = await fetchImpl(`${NOTION_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
  })
  if (res.status === 401 || res.status === 403) {
    throw new ProviderAuthError('notion')
  }
  if (!res.ok) throw new Error(`Notion API error (${res.status})`)
  return await res.json()
}

// Notion property payloads are dynamic per database; typed loosely on purpose.
// biome-ignore lint/suspicious/noExplicitAny: dynamic Notion property shapes
type NotionPage = { id: string; url?: string; properties: Record<string, any> }

export function mapNotionPage(
  page: NotionPage,
  mapping: PropertyMapping,
): UnifiedTask {
  const props = page.properties

  const titleProp = props[mapping.title]
  const title: string = (titleProp?.title ?? titleProp?.rich_text ?? [])
    .map((t: { plain_text?: string }) => t.plain_text ?? '')
    .join('')

  const doneProp = props[mapping.done]
  let done = false
  if (doneProp?.type === 'checkbox') done = doneProp.checkbox === true
  else if (doneProp?.type === 'status') {
    done = DONE_STATUS_NAMES.includes(
      (doneProp.status?.name ?? '').toLowerCase(),
    )
  }

  const dueProp = mapping.dueDate ? props[mapping.dueDate] : undefined
  const dueDate: string | undefined = dueProp?.date?.start?.slice(0, 10)

  const priorityProp = mapping.priority ? props[mapping.priority] : undefined
  const priorityMatch = /^p?([1-4])$/i.exec(priorityProp?.select?.name ?? '')
  const priority = priorityMatch
    ? (Number(priorityMatch[1]) as 1 | 2 | 3 | 4)
    : undefined

  const labelsProp = mapping.labels ? props[mapping.labels] : undefined
  const labels: string[] | undefined = labelsProp?.multi_select?.length
    ? labelsProp.multi_select.map((o: { name: string }) => o.name)
    : undefined

  return {
    externalId: page.id,
    title: title || '(untitled)',
    done,
    dueDate,
    priority,
    labels,
    url: page.url,
  }
}

export const notionAdapter: TaskProviderAdapter = {
  id: 'notion',
  capabilities: { write: false, priority: true, labels: true },

  async listAvailableSources(accessToken, fetchImpl = fetch) {
    const data = (await notionRequest(
      accessToken,
      '/search',
      {
        method: 'POST',
        body: JSON.stringify({
          filter: { property: 'object', value: 'database' },
          page_size: 100,
        }),
      },
      fetchImpl,
    )) as {
      results: Array<{ id: string; title?: Array<{ plain_text?: string }> }>
    }
    return data.results.map((db) => ({
      id: db.id,
      name:
        (db.title ?? []).map((t) => t.plain_text ?? '').join('') ||
        '(untitled database)',
    }))
  },

  async getSourceSchema(accessToken, sourceId, fetchImpl = fetch) {
    const data = (await notionRequest(
      accessToken,
      `/databases/${sourceId}`,
      { method: 'GET' },
      fetchImpl,
    )) as { properties: Record<string, { id: string; type: string }> }
    // Query results key properties by *name*, so mappings store names.
    return Object.entries(data.properties).map(([name, p]) => ({
      id: name,
      name,
      type: p.type,
    }))
  },

  async fetchTasks(accessToken, config: SourceConfig, fetchImpl = fetch) {
    const mapping = config.propertyMapping
    if (!mapping) {
      throw new Error('Notion list is missing its property mapping')
    }
    const tasks: UnifiedTask[] = []
    let cursor: string | undefined
    do {
      const data = (await notionRequest(
        accessToken,
        `/databases/${config.sourceId}/query`,
        {
          method: 'POST',
          body: JSON.stringify({
            page_size: 100,
            ...(cursor ? { start_cursor: cursor } : {}),
          }),
        },
        fetchImpl,
      )) as {
        results: NotionPage[]
        has_more: boolean
        next_cursor: string | null
      }
      tasks.push(...data.results.map((p) => mapNotionPage(p, mapping)))
      cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined
    } while (cursor)
    return tasks
  },
}
