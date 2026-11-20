import {
  type PropertyMapping,
  ProviderAuthError,
  type SourceConfig,
  type TaskProviderAdapter,
  type UnifiedTask,
} from './types'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'
/**
 * The version whose schema says a relation's `limit` (data sources, Notion's
 * 2025-09-03 API). Used only to read a list's schema, never its pages.
 */
const SCHEMA_VERSION = '2025-09-03'
const DONE_STATUS_NAMES = ['done', 'complete', 'completed']

async function notionRequest(
  accessToken: string,
  path: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
  version = NOTION_VERSION,
): Promise<unknown> {
  const res = await fetchImpl(`${NOTION_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Notion-Version': version,
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
 * (APP-304): the page a sub-item belongs to, in English and in Dutch. A name
 * counts only on a relation back to the list's own database (APP-451), unless
 * the schema could not be read at all.
 */
const PARENT_RELATION_NAMES = [
  'parent item',
  'parent task',
  'parent',
  'bovenliggend item',
]

const isParentName = (name: string) =>
  PARENT_RELATION_NAMES.includes(name.trim().toLowerCase())

/** A Notion id with or without its dashes, as one comparable string. */
const sameNotionId = (a: unknown, b: unknown) =>
  typeof a === 'string' &&
  typeof b === 'string' &&
  a.replaceAll('-', '').toLowerCase() === b.replaceAll('-', '').toLowerCase()

/** A database's property schema, keyed by property name. */
// biome-ignore lint/suspicious/noExplicitAny: dynamic Notion property shapes
export type NotionSchema = Record<string, any>

/**
 * The relation that names a page's parent in database `databaseId`, or null
 * for none (APP-451). Only a relation back to the database itself can be it;
 * one to another database never is, even one named "Parent". Among those it
 * needs a positive sign, in turn:
 *
 * 1. a limit of one page (a page has one parent; Notion's sub-items "Parent
 *    item" has it), when the schema says limits;
 * 2. a name Notion gives the parent relation (`PARENT_RELATION_NAMES`).
 *
 * Without one, nothing nests: "Blocked by" / "Blocking" (Notion's task
 * dependencies) are relations back to the database too, and guessing would
 * hide tasks under their blocker.
 */
export function parentRelationOf(
  schema: NotionSchema,
  databaseId: string,
): string | null {
  const home = Object.entries(schema)
    .filter(
      ([, prop]) =>
        prop?.type === 'relation' &&
        sameNotionId(prop.relation?.database_id, databaseId),
    )
    .map(([name, prop]) => ({ name, limit: prop.relation?.limit }))
  const one = <T>(list: T[]) => (list.length === 1 ? list[0] : undefined)
  const limited = home.filter((c) => c.limit === 1)
  const pool = limited.length > 1 ? limited : home
  return (
    one(limited)?.name ?? one(pool.filter((c) => isParentName(c.name)))?.name ?? null
  )
}

/**
 * The page this one is a sub-item of. `parentRelation` is the relation that
 * holds it (`parentRelationOf`), or null for none; left out, when the schema
 * is unknown, a relation with a known parent name does, as before APP-451.
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
 *
 * Read on Notion's data-source API first (`SCHEMA_VERSION`), the only one
 * whose relations say their `limit`: the database names its data source,
 * which holds the schema. A database with several data sources, or any other
 * refusal there, falls back to the schema on `NOTION_VERSION`, which has no
 * limits, so only a name can pick the parent.
 */
async function databaseSchema(
  accessToken: string,
  databaseId: string,
  fetchImpl: typeof fetch,
): Promise<NotionSchema | undefined> {
  const read = async (path: string, version?: string) => {
    try {
      return (await notionRequest(
        accessToken,
        path,
        { method: 'GET' },
        fetchImpl,
        version,
      )) as {
        properties?: NotionSchema
        data_sources?: Array<{ id?: string }>
      }
    } catch (error) {
      if (error instanceof ProviderAuthError) throw error
      return undefined
    }
  }
  const database = await read(`/databases/${databaseId}`, SCHEMA_VERSION)
  const sources = database?.data_sources ?? []
  const sourceId = sources.length === 1 ? sources[0]?.id : undefined
  if (sourceId) {
    const source = await read(`/data_sources/${sourceId}`, SCHEMA_VERSION)
    if (source?.properties) return source.properties
  }
  return (await read(`/databases/${databaseId}`))?.properties
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
      ? parentRelationOf(schema, config.sourceId)
      : undefined
    return oneLevelDeep(
      pages.map((p) => mapNotionPage(p, mapping, parentRelation)),
    )
  },
}
