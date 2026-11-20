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

/**
 * The names Notion gives the relation its sub-items feature adds to a database
 * (APP-304): the page a sub-item belongs to. Only a fallback (APP-451): the
 * parent is found by where a relation points (`parentRelationOf`), and a name
 * decides only when the database's schema could not be read, or to tell two
 * relations to the list's own database apart.
 */
const PARENT_RELATION_NAMES = ['parent item', 'parent task', 'parent']

const isParentName = (name: string) =>
  PARENT_RELATION_NAMES.includes(name.trim().toLowerCase())

/** A Notion id with or without its dashes, as one comparable string. */
const sameNotionId = (a: unknown, b: unknown) =>
  typeof a === 'string' &&
  typeof b === 'string' &&
  a.replaceAll('-', '').toLowerCase() === b.replaceAll('-', '').toLowerCase()

/** A database's property schema, as `GET /databases/{id}` answers it. */
// biome-ignore lint/suspicious/noExplicitAny: dynamic Notion property shapes
export type NotionSchema = Record<string, any>

/**
 * The relation that names a page's parent in database `databaseId`, or null
 * for none (APP-451). It is a relation back to the database itself, whatever
 * it is called: Notion's sub-items in any language, or a renamed one. A
 * relation to another database is never the parent, even one named "Parent".
 *
 * Sub-items are two relations to the database itself, "Parent item" and
 * "Sub-item", so when several point home one is picked by, in turn: a limit
 * of one page (when Notion says), a known English name, and the pages
 * themselves (a page with two or more on a relation shows that one holds
 * sub-items). Still undecided means no nesting, never a guess that could
 * hang pages under their own sub-items.
 */
export function parentRelationOf(
  schema: NotionSchema,
  databaseId: string,
  pages: readonly NotionPage[],
): string | null {
  let home = Object.entries(schema)
    .filter(
      ([, prop]) =>
        prop?.type === 'relation' &&
        sameNotionId(prop.relation?.database_id, databaseId),
    )
    .map(([name, prop]) => ({ name, limit: prop.relation?.limit }))
  const narrow = (keep: (c: (typeof home)[number]) => boolean) => {
    const kept = home.filter(keep)
    if (kept.length) home = kept
  }
  if (home.length > 1) narrow((c) => c.limit === 1)
  if (home.length > 1) narrow((c) => isParentName(c.name))
  if (home.length > 1) {
    narrow(
      (c) =>
        !pages.some((page) => (page.properties[c.name]?.relation?.length ?? 0) > 1),
    )
  }
  return home.length === 1 ? (home[0]?.name ?? null) : null
}

/**
 * The page this one is a sub-item of. `parentRelation` is the relation that
 * holds it (`parentRelationOf`), or null for none; left out, when the schema
 * is unknown, a relation with a known English name does.
 */
function parentOf(
  // biome-ignore lint/suspicious/noExplicitAny: dynamic Notion property shapes
  props: Record<string, any>,
  parentRelation: string | null | undefined,
): string | undefined {
  for (const [name, prop] of Object.entries(props)) {
    if (prop?.type !== 'relation') continue
    if (parentRelation === undefined ? !isParentName(name) : name !== parentRelation)
      continue
    const first = prop.relation?.[0]?.id
    if (typeof first === 'string') return first
  }
  return undefined
}

/**
 * Gather's subtasks are one level deep: a page whose parent is itself a
 * sub-item (Notion nests deeper), or that names a page not in the list, is
 * shown on its own, so nothing hides under a row that is never drawn.
 */
function oneLevelDeep(tasks: UnifiedTask[]): UnifiedTask[] {
  const byId = new Map(tasks.map((task) => [task.externalId, task]))
  return tasks.map((task) => {
    if (!task.parentExternalId) return task
    const parent = byId.get(task.parentExternalId)
    if (parent && !parent.parentExternalId) return task
    const { parentExternalId: _, ...rest } = task
    return rest
  })
}

export function mapNotionPage(
  page: NotionPage,
  mapping: PropertyMapping,
  parentRelation?: string | null,
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

  const parent = parentOf(props, parentRelation)

  return {
    externalId: page.id,
    title: title || '(untitled)',
    done,
    dueDate,
    priority,
    labels,
    url: page.url,
    ...(parent ? { parentExternalId: parent } : {}),
  }
}

/**
 * A database's property schema, or undefined when Notion would not give it:
 * the parent relation then falls back to its name. Access withdrawn still
 * asks to reconnect.
 */
async function databaseSchema(
  accessToken: string,
  databaseId: string,
  fetchImpl: typeof fetch,
): Promise<NotionSchema | undefined> {
  try {
    const data = (await notionRequest(
      accessToken,
      `/databases/${databaseId}`,
      { method: 'GET' },
      fetchImpl,
    )) as { properties?: NotionSchema }
    return data.properties
  } catch (error) {
    if (error instanceof ProviderAuthError) throw error
    return undefined
  }
}

export const notionAdapter: TaskProviderAdapter = {
  id: 'notion',
  capabilities: { write: false },

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
    const schema = await databaseSchema(accessToken, config.sourceId, fetchImpl)
    const pages: NotionPage[] = []
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
      pages.push(...data.results)
      cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined
    } while (cursor)
    const parentRelation = schema
      ? parentRelationOf(schema, config.sourceId, pages)
      : undefined
    return oneLevelDeep(
      pages.map((p) => mapNotionPage(p, mapping, parentRelation)),
    )
  },
}
