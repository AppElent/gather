# Tasks Module — Provider Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Tasks placeholder with a working module where a group has 0+ task lists, each backed by one provider: `local` (full CRUD in Convex), `notion`, or `todoist` (read-only mirrors pulled on demand).

**Architecture:** External providers are implemented as pure adapter modules (`convex/lib/taskProviders/`) behind a shared `TaskProviderAdapter` interface returning `UnifiedTask[]`. A single Convex action `taskLists.getTasks` dispatches by provider (local via internal query, external via adapter + stored OAuth token). OAuth connections are per-group rows in `integrationConnections`, managed from a Connections section on `/settings`; the token exchange happens in an authenticated Convex action (client id/secret in Convex env vars), with a client callback route `/integrations/callback`. Task lists reference their connection by `connectionId` (never by group+provider lookup) so multiple connections per provider stay possible later.

**Tech Stack:** Convex (queries/mutations/actions), TanStack Router file routes, Clerk auth (existing bridge), Tailwind v4, Vitest + Testing Library (jest-dom is available via `vitest.setup.ts`).

**Spec:** `docs/superpowers/specs/2026-07-17-tasks-provider-adapter-design.md`

**Conventions to follow (from this codebase):**
- Convex auth via `getCurrentUser` / `getMyGroupIds` from `convex/lib/sharing.ts`.
- User-facing errors thrown as `ConvexError('message')` (see `convex/recipeImport.ts`).
- Pure logic lives in `convex/lib/*` with co-located `*.test.ts` (see `recipeParsing.test.ts`).
- UI: `SurfaceCard` from `src/components/app/ShellPrimitives.tsx`, Tailwind with `var(--app-*)` tokens, lucide-react icons.
- Package manager: **pnpm, always**. Run commands from the repo root.
- **Never** return `accessToken` from a public query/mutation/action — only internal functions may read it.

**Group context (recorded assumption):** the Tasks page and connections operate on the user's `defaultGroupId` (same convention as recipes' default sharing). If the user has no default group, the UI prompts them to pick one on `/groups`.

**Implementation note:** `UnifiedTask` carries an optional `url` (link-out to the item in its source app) on top of the spec's shape — spec §6 requires the link-out, so the shape needs to carry it.

---

### Task 1: Schema — `taskLists`, `tasks`, `integrationConnections`

**Files:**
- Modify: `convex/schema.ts`

There is no convex-test harness in this repo, so schema/backend tasks are verified by typecheck instead of unit tests.

- [ ] **Step 1: Add the three tables**

Append inside the `defineSchema({ ... })` object in `convex/schema.ts`, after the `recipes` table:

```ts
  taskLists: defineTable({
    groupId: v.id('groups'),
    name: v.string(),
    provider: v.union(
      v.literal('local'),
      v.literal('notion'),
      v.literal('todoist'),
    ),
    providerConfig: v.optional(
      v.object({
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
      }),
    ),
    order: v.number(),
  }).index('by_group', ['groupId']),

  // Rows exist only for provider === 'local' lists.
  tasks: defineTable({
    listId: v.id('taskLists'),
    title: v.string(),
    done: v.boolean(),
    dueDate: v.optional(v.string()), // ISO date, YYYY-MM-DD
    priority: v.optional(
      v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4)),
    ),
    labels: v.optional(v.array(v.string())),
    createdBy: v.id('users'),
    order: v.number(),
  }).index('by_list', ['listId']),

  integrationConnections: defineTable({
    groupId: v.id('groups'),
    provider: v.union(v.literal('notion'), v.literal('todoist')),
    accessToken: v.string(), // server-only; never returned by a public function
    accountLabel: v.string(), // Notion workspace name / 'Todoist'
    connectedBy: v.id('users'),
  }).index('by_group_provider', ['groupId', 'provider']),
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (generated `dataModel` types flow from `schema.ts` without codegen).

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(tasks): add taskLists, tasks, integrationConnections tables"
```

---

### Task 2: Provider types and `ProviderAuthError`

**Files:**
- Create: `convex/lib/taskProviders/types.ts`

Pure types + one error class; no test file (nothing to execute yet — behavior is tested through the adapters in Tasks 3–4).

- [ ] **Step 1: Write the file**

```ts
export type ExternalProviderId = 'notion' | 'todoist'
export type ProviderId = 'local' | ExternalProviderId

export interface UnifiedTask {
  externalId: string
  title: string
  done: boolean
  dueDate?: string // ISO date, YYYY-MM-DD
  priority?: 1 | 2 | 3 | 4 // 1 = most urgent (Todoist "p1")
  labels?: string[]
  url?: string // link-out to the item in its source app (external only)
}

export interface ProviderSource {
  id: string
  name: string
}

export interface SourceProperty {
  id: string
  name: string
  type: string
}

export interface PropertyMapping {
  title: string
  done: string
  dueDate?: string
  priority?: string
  labels?: string
}

export interface SourceConfig {
  sourceId: string
  propertyMapping?: PropertyMapping
}

export interface ProviderCapabilities {
  write: boolean
  priority: boolean
  labels: boolean
}

/** Thrown when the provider rejects our token (expired/revoked). The UI
 * turns this into a "reconnect" prompt instead of a generic error. */
export class ProviderAuthError extends Error {
  constructor(provider: ExternalProviderId) {
    super(`${provider} connection is no longer valid`)
    this.name = 'ProviderAuthError'
  }
}

export interface TaskProviderAdapter {
  id: ExternalProviderId
  capabilities: ProviderCapabilities
  listAvailableSources(
    accessToken: string,
    fetchImpl?: typeof fetch,
  ): Promise<ProviderSource[]>
  getSourceSchema(
    accessToken: string,
    sourceId: string,
    fetchImpl?: typeof fetch,
  ): Promise<SourceProperty[]>
  fetchTasks(
    accessToken: string,
    config: SourceConfig,
    fetchImpl?: typeof fetch,
  ): Promise<UnifiedTask[]>
}
```

- [ ] **Step 2: Typecheck and commit**

Run: `pnpm typecheck` — expected: PASS.

```bash
git add convex/lib/taskProviders/types.ts
git commit -m "feat(tasks): define task provider adapter interface and UnifiedTask"
```

---

### Task 3: Notion adapter (TDD)

**Files:**
- Create: `convex/lib/taskProviders/notion.ts`
- Test: `convex/lib/taskProviders/notion.test.ts`

Notion API pinned to `Notion-Version: 2022-06-28` (stable database endpoints). Query results key properties by **name**, so the mapping stores property names.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test, vi } from 'vitest'
import { mapNotionPage, notionAdapter } from './notion'
import { ProviderAuthError } from './types'

const minimalMapping = { title: 'Name', done: 'Done' }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function statusPage(statusName: string) {
  return {
    id: 'p1',
    properties: {
      Name: { type: 'title', title: [{ plain_text: 'x' }] },
      Done: { type: 'status', status: { name: statusName } },
    },
  }
}

describe('mapNotionPage', () => {
  test('maps title, checkbox done, due date, priority and labels', () => {
    const task = mapNotionPage(
      {
        id: 'page-1',
        url: 'https://notion.so/page-1',
        properties: {
          Name: { type: 'title', title: [{ plain_text: 'Buy milk' }] },
          Done: { type: 'checkbox', checkbox: true },
          Due: { type: 'date', date: { start: '2026-07-20T00:00:00Z' } },
          Priority: { type: 'select', select: { name: 'P2' } },
          Tags: { type: 'multi_select', multi_select: [{ name: 'home' }] },
        },
      },
      {
        title: 'Name',
        done: 'Done',
        dueDate: 'Due',
        priority: 'Priority',
        labels: 'Tags',
      },
    )
    expect(task).toEqual({
      externalId: 'page-1',
      title: 'Buy milk',
      done: true,
      dueDate: '2026-07-20',
      priority: 2,
      labels: ['home'],
      url: 'https://notion.so/page-1',
    })
  })

  test('treats a status named Done/Complete/Completed as done', () => {
    expect(mapNotionPage(statusPage('Done'), minimalMapping).done).toBe(true)
    expect(mapNotionPage(statusPage('Completed'), minimalMapping).done).toBe(
      true,
    )
    expect(
      mapNotionPage(statusPage('In progress'), minimalMapping).done,
    ).toBe(false)
  })

  test('leaves unmapped optional fields undefined and defaults empty titles', () => {
    const task = mapNotionPage(
      {
        id: 'p2',
        properties: {
          Name: { type: 'title', title: [] },
          Done: { type: 'checkbox', checkbox: false },
        },
      },
      minimalMapping,
    )
    expect(task.title).toBe('(untitled)')
    expect(task.done).toBe(false)
    expect(task.dueDate).toBeUndefined()
    expect(task.priority).toBeUndefined()
    expect(task.labels).toBeUndefined()
  })
})

describe('notionAdapter', () => {
  test('listAvailableSources maps database search results', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        results: [
          { id: 'db1', title: [{ plain_text: 'Groceries' }] },
          { id: 'db2', title: [] },
        ],
      }),
    )
    const sources = await notionAdapter.listAvailableSources(
      'tok',
      fetchImpl as unknown as typeof fetch,
    )
    expect(sources).toEqual([
      { id: 'db1', name: 'Groceries' },
      { id: 'db2', name: '(untitled database)' },
    ])
  })

  test('getSourceSchema returns property name/type pairs', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        properties: {
          Name: { id: 'title', type: 'title' },
          Done: { id: 'abc', type: 'checkbox' },
        },
      }),
    )
    const schema = await notionAdapter.getSourceSchema(
      'tok',
      'db1',
      fetchImpl as unknown as typeof fetch,
    )
    expect(schema).toEqual([
      { id: 'Name', name: 'Name', type: 'title' },
      { id: 'Done', name: 'Done', type: 'checkbox' },
    ])
  })

  test('fetchTasks follows pagination and maps every page', async () => {
    const page = (id: string, title: string) => ({
      id,
      properties: {
        Name: { type: 'title', title: [{ plain_text: title }] },
        Done: { type: 'checkbox', checkbox: false },
      },
    })
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          results: [page('a', 'First')],
          has_more: true,
          next_cursor: 'cursor-2',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          results: [page('b', 'Second')],
          has_more: false,
          next_cursor: null,
        }),
      )
    const tasks = await notionAdapter.fetchTasks(
      'tok',
      { sourceId: 'db1', propertyMapping: minimalMapping },
      fetchImpl as unknown as typeof fetch,
    )
    expect(tasks.map((t) => t.title)).toEqual(['First', 'Second'])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const secondBody = JSON.parse(
      (fetchImpl.mock.calls[1][1] as RequestInit).body as string,
    )
    expect(secondBody.start_cursor).toBe('cursor-2')
  })

  test('fetchTasks throws ProviderAuthError on 401', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 401))
    await expect(
      notionAdapter.fetchTasks(
        'tok',
        { sourceId: 'db1', propertyMapping: minimalMapping },
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toBeInstanceOf(ProviderAuthError)
  })

  test('fetchTasks without a propertyMapping rejects', async () => {
    await expect(
      notionAdapter.fetchTasks(
        'tok',
        { sourceId: 'db1' },
        vi.fn() as unknown as typeof fetch,
      ),
    ).rejects.toThrow(/property mapping/)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test convex/lib/taskProviders/notion.test.ts`
Expected: FAIL — cannot resolve `./notion`.

- [ ] **Step 3: Implement `convex/lib/taskProviders/notion.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test convex/lib/taskProviders/notion.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/lib/taskProviders/notion.ts convex/lib/taskProviders/notion.test.ts
git commit -m "feat(tasks): Notion task provider adapter"
```

---

### Task 4: Todoist adapter + adapter registry (TDD)

**Files:**
- Create: `convex/lib/taskProviders/todoist.ts`
- Create: `convex/lib/taskProviders/index.ts`
- Test: `convex/lib/taskProviders/todoist.test.ts`

Todoist REST API v2. Its `/tasks` endpoint returns **active tasks only**, so mirrored tasks are always `done: false` (open items) — this is expected and documented in the UI copy. API priority is inverted vs the UI: API `4` = "p1" (most urgent), so `ui = 5 - api`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test, vi } from 'vitest'
import { mapTodoistTask, todoistAdapter } from './todoist'
import { ProviderAuthError } from './types'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

describe('mapTodoistTask', () => {
  test('maps content, due date, labels, url and inverts priority', () => {
    expect(
      mapTodoistTask({
        id: '42',
        content: 'Water plants',
        due: { date: '2026-07-21' },
        priority: 4, // API 4 = UI p1 (most urgent)
        labels: ['home'],
        url: 'https://todoist.com/showTask?id=42',
      }),
    ).toEqual({
      externalId: '42',
      title: 'Water plants',
      done: false,
      dueDate: '2026-07-21',
      priority: 1,
      labels: ['home'],
      url: 'https://todoist.com/showTask?id=42',
    })
  })

  test('normal priority maps to 4 and empty labels become undefined', () => {
    const task = mapTodoistTask({
      id: '1',
      content: 'x',
      priority: 1,
      labels: [],
    })
    expect(task.priority).toBe(4)
    expect(task.labels).toBeUndefined()
    expect(task.dueDate).toBeUndefined()
  })
})

describe('todoistAdapter', () => {
  test('listAvailableSources maps projects', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse([{ id: 'p1', name: 'Household', extra: true }]),
      )
    const sources = await todoistAdapter.listAvailableSources(
      'tok',
      fetchImpl as unknown as typeof fetch,
    )
    expect(sources).toEqual([{ id: 'p1', name: 'Household' }])
  })

  test('fetchTasks requests the project and maps tasks', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse([{ id: 't1', content: 'Task one', priority: 1 }]),
      )
    const tasks = await todoistAdapter.fetchTasks(
      'tok',
      { sourceId: 'p1' },
      fetchImpl as unknown as typeof fetch,
    )
    expect(tasks[0].title).toBe('Task one')
    expect(fetchImpl.mock.calls[0][0]).toContain('project_id=p1')
  })

  test('fetchTasks throws ProviderAuthError on 401', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 401))
    await expect(
      todoistAdapter.fetchTasks(
        'tok',
        { sourceId: 'p1' },
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toBeInstanceOf(ProviderAuthError)
  })

  test('getSourceSchema is empty (fixed schema, nothing to map)', async () => {
    await expect(todoistAdapter.getSourceSchema('tok', 'p1')).resolves.toEqual(
      [],
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test convex/lib/taskProviders/todoist.test.ts`
Expected: FAIL — cannot resolve `./todoist`.

- [ ] **Step 3: Implement `convex/lib/taskProviders/todoist.ts`**

```ts
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
```

- [ ] **Step 4: Create the registry `convex/lib/taskProviders/index.ts`**

```ts
import { notionAdapter } from './notion'
import { todoistAdapter } from './todoist'
import type { ExternalProviderId, TaskProviderAdapter } from './types'

const adapters: Record<ExternalProviderId, TaskProviderAdapter> = {
  notion: notionAdapter,
  todoist: todoistAdapter,
}

/** Future providers (e.g. Outlook) register here — one new module, one line. */
export function getAdapter(id: ExternalProviderId): TaskProviderAdapter {
  return adapters[id]
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test convex/lib/taskProviders/todoist.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add convex/lib/taskProviders/todoist.ts convex/lib/taskProviders/todoist.test.ts convex/lib/taskProviders/index.ts
git commit -m "feat(tasks): Todoist adapter and provider registry"
```

---

### Task 5: Integrations backend (`convex/integrations.ts`)

**Files:**
- Create: `convex/integrations.ts`

OAuth secrets live in **Convex env vars** (`NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `TODOIST_CLIENT_ID`, `TODOIST_CLIENT_SECRET` — set via `convex env set`, never committed). Actions run in Convex's default runtime (`fetch` and `btoa` are available; no `'use node'` needed).

- [ ] **Step 1: Write the file**

```ts
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import type { ActionCtx } from './_generated/server'
import { getAdapter } from './lib/taskProviders'
import {
  type ExternalProviderId,
  ProviderAuthError,
  type ProviderSource,
  type SourceProperty,
} from './lib/taskProviders/types'
import { getCurrentUser, getMyGroupIds } from './lib/sharing'

const externalProvider = v.union(v.literal('notion'), v.literal('todoist'))

// ---------- public queries/mutations (no tokens ever leave here) ----------

export const listConnections = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user?.defaultGroupId) return []
    const groupId = user.defaultGroupId
    const rows = await ctx.db
      .query('integrationConnections')
      .withIndex('by_group_provider', (q) => q.eq('groupId', groupId))
      .collect()
    return await Promise.all(
      rows.map(async (r) => ({
        _id: r._id,
        provider: r.provider,
        accountLabel: r.accountLabel,
        connectedByName: (await ctx.db.get(r.connectedBy))?.name ?? 'Unknown',
      })),
    )
  },
})

export const disconnect = mutation({
  args: { connectionId: v.id('integrationConnections') },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new ConvexError('Not authenticated')
    const conn = await ctx.db.get(args.connectionId)
    if (!conn) return
    const groupIds = await getMyGroupIds(ctx, user._id)
    if (!groupIds.includes(conn.groupId)) {
      throw new ConvexError('Not a member of that group')
    }
    // Linked lists keep their (now dangling) connectionId — they surface a
    // reconnect prompt until the provider is connected again (spec §5.1/§7).
    await ctx.db.delete(args.connectionId)
  },
})

// ---------- internal (may touch tokens) ----------

export const getViewer = internalQuery({
  args: {},
  handler: async (ctx) => await getCurrentUser(ctx),
})

export const getConnection = internalQuery({
  args: { connectionId: v.id('integrationConnections') },
  handler: async (ctx, args) => await ctx.db.get(args.connectionId),
})

export const getMyConnection = internalQuery({
  args: { provider: externalProvider },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user?.defaultGroupId) return null
    const groupId = user.defaultGroupId
    return await ctx.db
      .query('integrationConnections')
      .withIndex('by_group_provider', (q) =>
        q.eq('groupId', groupId).eq('provider', args.provider),
      )
      .unique()
  },
})

export const storeConnection = internalMutation({
  args: {
    groupId: v.id('groups'),
    provider: externalProvider,
    accessToken: v.string(),
    accountLabel: v.string(),
    connectedBy: v.id('users'),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('integrationConnections')
      .withIndex('by_group_provider', (q) =>
        q.eq('groupId', args.groupId).eq('provider', args.provider),
      )
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        accountLabel: args.accountLabel,
        connectedBy: args.connectedBy,
      })
      return existing._id
    }
    return await ctx.db.insert('integrationConnections', args)
  },
})

// ---------- actions ----------

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new ConvexError(
      `Integration not configured — the ${name} Convex env var is missing`,
    )
  }
  return value
}

export const getAuthorizeUrl = action({
  args: {
    provider: externalProvider,
    redirectUri: v.string(),
    state: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError('Not authenticated')
    if (args.provider === 'notion') {
      const url = new URL('https://api.notion.com/v1/oauth/authorize')
      url.searchParams.set('client_id', requireEnv('NOTION_CLIENT_ID'))
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('owner', 'user')
      url.searchParams.set('redirect_uri', args.redirectUri)
      url.searchParams.set('state', args.state)
      return url.toString()
    }
    const url = new URL('https://todoist.com/oauth/authorize')
    url.searchParams.set('client_id', requireEnv('TODOIST_CLIENT_ID'))
    url.searchParams.set('scope', 'data:read')
    url.searchParams.set('state', args.state)
    return url.toString()
  },
})

export const completeOAuth = action({
  args: {
    provider: externalProvider,
    code: v.string(),
    redirectUri: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await ctx.runQuery(internal.integrations.getViewer, {})
    if (!user) throw new ConvexError('Not authenticated')
    if (!user.defaultGroupId) {
      throw new ConvexError('Set a default group on the Groups page first')
    }

    let accessToken: string
    let accountLabel: string
    if (args.provider === 'notion') {
      const clientId = requireEnv('NOTION_CLIENT_ID')
      const clientSecret = requireEnv('NOTION_CLIENT_SECRET')
      const res = await fetch('https://api.notion.com/v1/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: args.code,
          redirect_uri: args.redirectUri,
        }),
      })
      if (!res.ok) {
        throw new ConvexError('Notion rejected the connection — try again')
      }
      const data = (await res.json()) as {
        access_token: string
        workspace_name?: string
      }
      accessToken = data.access_token
      accountLabel = data.workspace_name ?? 'Notion workspace'
    } else {
      const body = new URLSearchParams({
        client_id: requireEnv('TODOIST_CLIENT_ID'),
        client_secret: requireEnv('TODOIST_CLIENT_SECRET'),
        code: args.code,
      })
      const res = await fetch('https://todoist.com/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
      if (!res.ok) {
        throw new ConvexError('Todoist rejected the connection — try again')
      }
      const data = (await res.json()) as { access_token: string }
      accessToken = data.access_token
      accountLabel = 'Todoist'
    }

    await ctx.runMutation(internal.integrations.storeConnection, {
      groupId: user.defaultGroupId,
      provider: args.provider,
      accessToken,
      accountLabel,
      connectedBy: user._id,
    })
  },
})

async function requireMyConnection(ctx: ActionCtx, provider: ExternalProviderId) {
  const conn = await ctx.runQuery(internal.integrations.getMyConnection, {
    provider,
  })
  if (!conn) {
    throw new ConvexError(
      `No ${provider} connection for your group — connect it in Settings`,
    )
  }
  return conn
}

function toUserError(error: unknown, provider: ExternalProviderId): never {
  if (error instanceof ProviderAuthError) {
    throw new ConvexError(
      `Your ${provider} connection expired — reconnect it in Settings`,
    )
  }
  if (error instanceof ConvexError) throw error
  throw new ConvexError(`Could not reach ${provider} — try again`)
}

export const listSources = action({
  args: { provider: externalProvider },
  handler: async (ctx, args): Promise<ProviderSource[]> => {
    const conn = await requireMyConnection(ctx, args.provider)
    try {
      return await getAdapter(args.provider).listAvailableSources(
        conn.accessToken,
      )
    } catch (error) {
      toUserError(error, args.provider)
    }
  },
})

export const getSourceSchema = action({
  args: { provider: externalProvider, sourceId: v.string() },
  handler: async (ctx, args): Promise<SourceProperty[]> => {
    const conn = await requireMyConnection(ctx, args.provider)
    try {
      return await getAdapter(args.provider).getSourceSchema(
        conn.accessToken,
        args.sourceId,
      )
    } catch (error) {
      toUserError(error, args.provider)
    }
  },
})
```

- [ ] **Step 2: Regenerate Convex API types**

Run: `pnpm exec convex codegen`
Expected: `convex/_generated/api.d.ts` now includes `integrations`. (If `codegen` requires a deployment and fails, run `pnpm exec convex dev --once` instead — `.env.local` has `CONVEX_DEPLOYMENT`.)

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add convex/integrations.ts convex/_generated
git commit -m "feat(tasks): per-group integration connections with OAuth actions"
```

---

### Task 6: Task lists + local tasks backend

**Files:**
- Create: `convex/lib/taskAccess.ts`
- Create: `convex/taskLists.ts`
- Create: `convex/tasks.ts`

- [ ] **Step 1: Create `convex/lib/taskAccess.ts`**

```ts
import { ConvexError } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { getCurrentUser, getMyGroupIds } from './sharing'

/** Resolve the caller and the list, asserting group membership. */
export async function requireListAccess(
  ctx: QueryCtx,
  listId: Id<'taskLists'>,
) {
  const user = await getCurrentUser(ctx)
  if (!user) throw new ConvexError('Not authenticated')
  const list = await ctx.db.get(listId)
  if (!list) throw new ConvexError('List not found')
  const groupIds = await getMyGroupIds(ctx, user._id)
  if (!groupIds.includes(list.groupId)) {
    throw new ConvexError('Not a member of this group')
  }
  return { user, list }
}
```

- [ ] **Step 2: Create `convex/taskLists.ts`**

```ts
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { action, internalQuery, mutation, query } from './_generated/server'
import { getAdapter } from './lib/taskProviders'
import {
  ProviderAuthError,
  type UnifiedTask,
} from './lib/taskProviders/types'
import { requireListAccess } from './lib/taskAccess'
import { getCurrentUser } from './lib/sharing'

const providerConfigValidator = v.object({
  connectionId: v.id('integrationConnections'),
  sourceId: v.string(),
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

/** Lists for the viewer's default group; null = no default group set. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user?.defaultGroupId) return null
    const groupId = user.defaultGroupId
    const lists = await ctx.db
      .query('taskLists')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect()
    return lists
      .sort((a, b) => a.order - b.order)
      .map((l) => ({ _id: l._id, name: l.name, provider: l.provider }))
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    provider: v.union(
      v.literal('local'),
      v.literal('notion'),
      v.literal('todoist'),
    ),
    providerConfig: v.optional(providerConfigValidator),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new ConvexError('Not authenticated')
    if (!user.defaultGroupId) {
      throw new ConvexError('Set a default group on the Groups page first')
    }
    const groupId = user.defaultGroupId

    if (args.provider === 'local') {
      if (args.providerConfig) {
        throw new ConvexError('Local lists take no provider config')
      }
    } else {
      if (!args.providerConfig) {
        throw new ConvexError('External lists need a provider config')
      }
      if (args.provider === 'notion' && !args.providerConfig.propertyMapping) {
        throw new ConvexError('Notion lists need a property mapping')
      }
      const conn = await ctx.db.get(args.providerConfig.connectionId)
      if (!conn || conn.groupId !== groupId || conn.provider !== args.provider) {
        throw new ConvexError('That connection does not belong to this group')
      }
    }

    const existing = await ctx.db
      .query('taskLists')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect()
    return await ctx.db.insert('taskLists', {
      groupId,
      name: args.name,
      provider: args.provider,
      providerConfig: args.providerConfig,
      order: existing.length,
    })
  },
})

export const rename = mutation({
  args: { listId: v.id('taskLists'), name: v.string() },
  handler: async (ctx, args) => {
    await requireListAccess(ctx, args.listId)
    await ctx.db.patch(args.listId, { name: args.name })
  },
})

export const remove = mutation({
  args: { listId: v.id('taskLists') },
  handler: async (ctx, args) => {
    await requireListAccess(ctx, args.listId)
    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_list', (q) => q.eq('listId', args.listId))
      .collect()
    await Promise.all(tasks.map((t) => ctx.db.delete(t._id)))
    await ctx.db.delete(args.listId)
  },
})

export const getList = internalQuery({
  args: { listId: v.id('taskLists') },
  handler: async (ctx, args) => {
    const { list } = await requireListAccess(ctx, args.listId)
    return list
  },
})

export type GetTasksResult =
  | { status: 'ok'; tasks: UnifiedTask[] }
  | { status: 'reconnect'; provider: 'notion' | 'todoist' }
  | { status: 'error'; message: string }

/** Unified entry point: returns UnifiedTask[] for any list, dispatching by
 * provider (spec §3). Local lists resolve from the tasks table; external
 * lists go through the matching adapter with the stored token. */
export const getTasks = action({
  args: { listId: v.id('taskLists') },
  handler: async (ctx, args): Promise<GetTasksResult> => {
    const list = await ctx.runQuery(internal.taskLists.getList, {
      listId: args.listId,
    })

    if (list.provider === 'local') {
      const rows = await ctx.runQuery(internal.tasks.listByListInternal, {
        listId: args.listId,
      })
      return {
        status: 'ok',
        tasks: rows.map((t) => ({
          externalId: t._id,
          title: t.title,
          done: t.done,
          dueDate: t.dueDate,
          priority: t.priority,
          labels: t.labels,
        })),
      }
    }

    const config = list.providerConfig
    if (!config) {
      return {
        status: 'error',
        message: 'This list is missing its provider configuration',
      }
    }
    const conn = await ctx.runQuery(internal.integrations.getConnection, {
      connectionId: config.connectionId,
    })
    if (!conn) return { status: 'reconnect', provider: list.provider }
    try {
      const tasks = await getAdapter(list.provider).fetchTasks(
        conn.accessToken,
        config,
      )
      return { status: 'ok', tasks }
    } catch (error) {
      if (error instanceof ProviderAuthError) {
        return { status: 'reconnect', provider: list.provider }
      }
      return {
        status: 'error',
        message: `Could not load tasks from ${list.provider} — try refreshing`,
      }
    }
  },
})
```

- [ ] **Step 3: Create `convex/tasks.ts`** (local-list CRUD)

```ts
import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { internalQuery, mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import { requireListAccess } from './lib/taskAccess'

const byOpenThenOrder = (a: Doc<'tasks'>, b: Doc<'tasks'>) =>
  Number(a.done) - Number(b.done) || a.order - b.order

export const listByList = query({
  args: { listId: v.id('taskLists') },
  handler: async (ctx, args) => {
    await requireListAccess(ctx, args.listId)
    const rows = await ctx.db
      .query('tasks')
      .withIndex('by_list', (q) => q.eq('listId', args.listId))
      .collect()
    return rows.sort(byOpenThenOrder)
  },
})

// Used by taskLists.getTasks, which has already authorized the list.
export const listByListInternal = internalQuery({
  args: { listId: v.id('taskLists') },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('tasks')
      .withIndex('by_list', (q) => q.eq('listId', args.listId))
      .collect()
    return rows.sort(byOpenThenOrder)
  },
})

const priorityValidator = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(3),
  v.literal(4),
)

async function requireEditableTask(ctx: MutationCtx, taskId: Id<'tasks'>) {
  const task = await ctx.db.get(taskId)
  if (!task) throw new ConvexError('Task not found')
  const { list } = await requireListAccess(ctx, task.listId)
  if (list.provider !== 'local') throw new ConvexError('This list is read-only')
  return task
}

export const add = mutation({
  args: {
    listId: v.id('taskLists'),
    title: v.string(),
    dueDate: v.optional(v.string()),
    priority: v.optional(priorityValidator),
    labels: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { user, list } = await requireListAccess(ctx, args.listId)
    if (list.provider !== 'local') {
      throw new ConvexError('This list is read-only')
    }
    const existing = await ctx.db
      .query('tasks')
      .withIndex('by_list', (q) => q.eq('listId', args.listId))
      .collect()
    return await ctx.db.insert('tasks', {
      listId: args.listId,
      title: args.title,
      done: false,
      dueDate: args.dueDate,
      priority: args.priority,
      labels: args.labels,
      createdBy: user._id,
      order: existing.length,
    })
  },
})

export const toggleDone = mutation({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, args) => {
    const task = await requireEditableTask(ctx, args.taskId)
    await ctx.db.patch(args.taskId, { done: !task.done })
  },
})

export const update = mutation({
  args: {
    taskId: v.id('tasks'),
    title: v.string(),
    // null clears the field (same pattern as recipes.update)
    dueDate: v.optional(v.union(v.string(), v.null())),
    priority: v.optional(v.union(priorityValidator, v.null())),
    labels: v.optional(v.union(v.array(v.string()), v.null())),
  },
  handler: async (ctx, args) => {
    await requireEditableTask(ctx, args.taskId)
    const { taskId, title, dueDate, priority, labels } = args
    await ctx.db.patch(taskId, {
      title,
      ...(dueDate !== undefined ? { dueDate: dueDate ?? undefined } : {}),
      ...(priority !== undefined ? { priority: priority ?? undefined } : {}),
      ...(labels !== undefined ? { labels: labels ?? undefined } : {}),
    })
  },
})

export const remove = mutation({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, args) => {
    await requireEditableTask(ctx, args.taskId)
    await ctx.db.delete(args.taskId)
  },
})

/** Swap order with the adjacent task in the current sorted view. */
export const move = mutation({
  args: {
    taskId: v.id('tasks'),
    direction: v.union(v.literal('up'), v.literal('down')),
  },
  handler: async (ctx, args) => {
    const task = await requireEditableTask(ctx, args.taskId)
    const siblings = (
      await ctx.db
        .query('tasks')
        .withIndex('by_list', (q) => q.eq('listId', task.listId))
        .collect()
    ).sort(byOpenThenOrder)
    const index = siblings.findIndex((t) => t._id === args.taskId)
    const neighbor =
      siblings[args.direction === 'up' ? index - 1 : index + 1]
    if (!neighbor || neighbor.done !== task.done) return
    await ctx.db.patch(task._id, { order: neighbor.order })
    await ctx.db.patch(neighbor._id, { order: task.order })
  },
})
```

- [ ] **Step 4: Regenerate types, typecheck, run all tests**

Run: `pnpm exec convex codegen && pnpm typecheck && pnpm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/lib/taskAccess.ts convex/taskLists.ts convex/tasks.ts convex/_generated
git commit -m "feat(tasks): task list queries, local CRUD, and unified getTasks dispatch"
```

---

### Task 7: OAuth client helper, callback route, Connections settings

**Files:**
- Create: `src/lib/oauth.ts`
- Create: `src/routes/_app/integrations.callback.tsx`
- Create: `src/components/settings/ConnectionsSettings.tsx`
- Modify: `src/routes/_app/settings.tsx`

- [ ] **Step 1: Create `src/lib/oauth.ts`**

```ts
export type ExternalProvider = 'notion' | 'todoist'

const STATE_KEY = 'gather.oauth.state'
const RETURN_KEY = 'gather.oauth.returnTo'

export function oauthRedirectUri(): string {
  return `${window.location.origin}/integrations/callback`
}

/** Create and persist a CSRF state; remember where to return afterwards. */
export function newOAuthState(
  provider: ExternalProvider,
  returnTo: string,
): string {
  const state = `${provider}.${crypto.randomUUID()}`
  sessionStorage.setItem(STATE_KEY, state)
  sessionStorage.setItem(RETURN_KEY, returnTo)
  return state
}

/** Validate the returned state; yields the provider or null on mismatch. */
export function consumeOAuthState(
  state: string | undefined,
): { provider: ExternalProvider; returnTo: string } | null {
  const stored = sessionStorage.getItem(STATE_KEY)
  const returnTo = sessionStorage.getItem(RETURN_KEY) ?? '/settings'
  sessionStorage.removeItem(STATE_KEY)
  sessionStorage.removeItem(RETURN_KEY)
  if (!state || !stored || state !== stored) return null
  const provider = state.split('.')[0]
  if (provider !== 'notion' && provider !== 'todoist') return null
  return { provider, returnTo }
}
```

- [ ] **Step 2: Create `src/components/settings/ConnectionsSettings.tsx`**

```tsx
import { useAction, useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import {
  type ExternalProvider,
  newOAuthState,
  oauthRedirectUri,
} from '../../lib/oauth'
import { SurfaceCard } from '../app/ShellPrimitives'

const PROVIDERS: Array<{ id: ExternalProvider; label: string }> = [
  { id: 'notion', label: 'Notion' },
  { id: 'todoist', label: 'Todoist' },
]

const buttonClass =
  'inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold'

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ConvexError && typeof error.data === 'string') {
    return error.data
  }
  return fallback
}

/** Starts the provider OAuth flow; shared with the Tasks add-list flow. */
export function useConnectProvider(returnTo: string) {
  const getAuthorizeUrl = useAction(api.integrations.getAuthorizeUrl)
  return async (provider: ExternalProvider) => {
    const url = await getAuthorizeUrl({
      provider,
      redirectUri: oauthRedirectUri(),
      state: newOAuthState(provider, returnTo),
    })
    window.location.href = url
  }
}

export function ConnectionsSettings() {
  const connections = useQuery(api.integrations.listConnections)
  const disconnect = useMutation(api.integrations.disconnect)
  const connect = useConnectProvider('/settings')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<ExternalProvider | null>(null)

  async function onConnect(provider: ExternalProvider) {
    setError(null)
    setBusy(provider)
    try {
      await connect(provider)
    } catch (e) {
      setBusy(null)
      setError(errorMessage(e, 'Could not start the connection — try again.'))
    }
  }

  return (
    <SurfaceCard>
      <h2 className="m-0 mb-1 text-base font-semibold">Connections</h2>
      <p className="m-0 mb-3 text-sm text-[var(--app-muted)]">
        Connect external apps for your whole group. Modules like Tasks can
        link lists to a connected app.
      </p>
      {error && <p className="m-0 mb-2 text-sm text-red-600">{error}</p>}
      <ul className="m-0 grid list-none gap-2 p-0">
        {PROVIDERS.map((p) => {
          const conn = connections?.find((c) => c.provider === p.id)
          return (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 py-2"
            >
              <div>
                <span className="text-sm font-semibold">{p.label}</span>
                <p className="m-0 text-xs text-[var(--app-muted)]">
                  {conn
                    ? `${conn.accountLabel} — connected by ${conn.connectedByName}`
                    : 'Not connected'}
                </p>
              </div>
              {conn ? (
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Disconnect ${p.label}? Linked lists will stop loading until it is reconnected.`,
                      )
                    ) {
                      void disconnect({ connectionId: conn._id })
                    }
                  }}
                >
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  className={buttonClass}
                  disabled={busy === p.id}
                  onClick={() => void onConnect(p.id)}
                >
                  {busy === p.id ? 'Opening…' : 'Connect'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </SurfaceCard>
  )
}
```

- [ ] **Step 3: Add the section to `src/routes/_app/settings.tsx`**

```tsx
import { AppearanceSettings } from '@appelent/auth'
import { createFileRoute } from '@tanstack/react-router'
import { ConnectionsSettings } from '../../components/settings/ConnectionsSettings'

export const Route = createFileRoute('/_app/settings')({
  component: () => (
    <div className="mx-auto grid max-w-2xl gap-4">
      <h1 className="m-0 text-xl font-semibold">Settings</h1>
      <AppearanceSettings />
      <ConnectionsSettings />
    </div>
  ),
})
```

- [ ] **Step 4: Create `src/routes/_app/integrations.callback.tsx`**

```tsx
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAction } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { SurfaceCard } from '../../components/app/ShellPrimitives'
import { errorMessage } from '../../components/settings/ConnectionsSettings'
import { consumeOAuthState, oauthRedirectUri } from '../../lib/oauth'

export const Route = createFileRoute('/_app/integrations/callback')({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === 'string' ? search.code : undefined,
    state: typeof search.state === 'string' ? search.state : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  component: OAuthCallback,
})

function OAuthCallback() {
  const { code, state, error } = Route.useSearch()
  const completeOAuth = useAction(api.integrations.completeOAuth)
  const navigate = useNavigate()
  const [failure, setFailure] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const consumed = consumeOAuthState(state)
    if (error) {
      setFailure('The connection was cancelled or refused.')
      return
    }
    if (!code || !consumed) {
      setFailure('Invalid connection response — try connecting again.')
      return
    }
    completeOAuth({
      provider: consumed.provider,
      code,
      redirectUri: oauthRedirectUri(),
    })
      .then(() => navigate({ to: consumed.returnTo }))
      .catch((e) =>
        setFailure(errorMessage(e, 'Connecting failed — try again.')),
      )
  }, [code, state, error, completeOAuth, navigate])

  return (
    <div className="mx-auto max-w-md">
      <SurfaceCard>
        {failure ? (
          <div className="grid gap-2">
            <h2 className="m-0 text-base font-semibold">Connection failed</h2>
            <p className="m-0 text-sm text-[var(--app-muted)]">{failure}</p>
            <Link to="/settings" className="text-sm font-semibold">
              Back to settings
            </Link>
          </div>
        ) : (
          <p className="m-0 text-sm text-[var(--app-muted)]">
            Finishing the connection…
          </p>
        )}
      </SurfaceCard>
    </div>
  )
}
```

- [ ] **Step 5: Regenerate routes, typecheck, lint**

Run: `pnpm generate-routes && pnpm typecheck && pnpm lint`
Expected: route tree includes `/_app/integrations/callback`; typecheck and lint PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/oauth.ts src/components/settings/ConnectionsSettings.tsx src/routes/_app/settings.tsx src/routes/_app/integrations.callback.tsx src/routeTree.gen.ts
git commit -m "feat(settings): group-level Connections section with OAuth callback route"
```

---

### Task 8: Task UI building blocks — `TaskRow` (TDD), `LocalTaskList`, `ExternalTaskList`

**Files:**
- Create: `src/components/tasks/TaskRow.tsx`
- Test: `src/components/tasks/TaskRow.test.tsx`
- Create: `src/components/tasks/TaskEditor.tsx`
- Create: `src/components/tasks/LocalTaskList.tsx`
- Create: `src/components/tasks/ExternalTaskList.tsx`

- [ ] **Step 1: Write the failing `TaskRow` tests**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { TaskRow } from './TaskRow'

const fullTask = {
  externalId: '1',
  title: 'Buy milk',
  done: false,
  dueDate: '2026-07-20',
  priority: 1 as const,
  labels: ['home'],
  url: 'https://todoist.com/showTask?id=1',
}

test('renders title, priority, labels, due date and link-out', () => {
  render(<TaskRow task={fullTask} />)
  expect(screen.getByText('Buy milk')).toBeInTheDocument()
  expect(screen.getByText('P1')).toBeInTheDocument()
  expect(screen.getByText('home')).toBeInTheDocument()
  expect(screen.getByText('2026-07-20')).toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: /open buy milk/i }),
  ).toHaveAttribute('href', 'https://todoist.com/showTask?id=1')
  expect(screen.getByRole('checkbox')).toBeDisabled()
})

test('checkbox toggles when onToggle is provided', () => {
  const onToggle = vi.fn()
  render(
    <TaskRow
      task={{ externalId: '1', title: 'x', done: false }}
      onToggle={onToggle}
    />,
  )
  const checkbox = screen.getByRole('checkbox')
  expect(checkbox).toBeEnabled()
  fireEvent.click(checkbox)
  expect(onToggle).toHaveBeenCalledOnce()
})

test('done tasks render struck through', () => {
  render(<TaskRow task={{ externalId: '1', title: 'Old', done: true }} />)
  expect(screen.getByText('Old').className).toContain('line-through')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/components/tasks/TaskRow.test.tsx`
Expected: FAIL — cannot resolve `./TaskRow`.

- [ ] **Step 3: Implement `src/components/tasks/TaskRow.tsx`**

```tsx
import { ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { UnifiedTask } from '../../../convex/lib/taskProviders/types'

const PRIORITY_STYLES: Record<1 | 2 | 3 | 4, string> = {
  1: 'bg-red-500/15 text-red-600',
  2: 'bg-orange-500/15 text-orange-600',
  3: 'bg-blue-500/15 text-blue-600',
  4: 'bg-[var(--app-surface-muted)] text-[var(--app-muted)]',
}

export interface TaskRowProps {
  task: UnifiedTask
  onToggle?: () => void
  /** Extra per-row controls (edit/delete/move) rendered at the end. */
  actions?: ReactNode
}

export function TaskRow({ task, onToggle, actions }: TaskRowProps) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <input
        type="checkbox"
        checked={task.done}
        disabled={!onToggle}
        onChange={onToggle}
        aria-label={`Toggle ${task.title}`}
      />
      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          task.done ? 'text-[var(--app-muted)] line-through' : ''
        }`}
      >
        {task.title}
      </span>
      {task.priority && (
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-semibold ${PRIORITY_STYLES[task.priority]}`}
        >
          P{task.priority}
        </span>
      )}
      {task.labels?.map((label) => (
        <span
          key={label}
          className="rounded bg-[var(--app-surface-muted)] px-1.5 py-0.5 text-xs text-[var(--app-muted)]"
        >
          {label}
        </span>
      ))}
      {task.dueDate && (
        <span className="text-xs text-[var(--app-muted)]">{task.dueDate}</span>
      )}
      {task.url && (
        <a
          href={task.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${task.title} in its source app`}
          className="text-[var(--app-muted)]"
        >
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      )}
      {actions}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/components/tasks/TaskRow.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement `src/components/tasks/TaskEditor.tsx`** (shared add/edit form for local tasks)

```tsx
import { useState } from 'react'

export interface TaskEditorValues {
  title: string
  dueDate?: string
  priority?: 1 | 2 | 3 | 4
  labels?: string[]
}

export interface TaskEditorProps {
  initial?: TaskEditorValues
  submitLabel: string
  onSubmit: (values: TaskEditorValues) => void
  onCancel: () => void
}

const inputClass =
  'min-h-9 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-transparent px-2 text-sm'

export function TaskEditor({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: TaskEditorProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '')
  const [priority, setPriority] = useState<string>(
    initial?.priority ? String(initial.priority) : '',
  )
  const [labels, setLabels] = useState(initial?.labels?.join(', ') ?? '')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    const parsedLabels = labels
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean)
    onSubmit({
      title: trimmed,
      dueDate: dueDate || undefined,
      priority: priority ? (Number(priority) as 1 | 2 | 3 | 4) : undefined,
      labels: parsedLabels.length ? parsedLabels : undefined,
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-2 py-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        aria-label="Task title"
        className={inputClass}
      />
      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          aria-label="Due date"
          className={inputClass}
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          aria-label="Priority"
          className={inputClass}
        >
          <option value="">No priority</option>
          <option value="1">P1 — urgent</option>
          <option value="2">P2</option>
          <option value="3">P3</option>
          <option value="4">P4</option>
        </select>
        <input
          value={labels}
          onChange={(e) => setLabels(e.target.value)}
          placeholder="Labels, comma-separated"
          aria-label="Labels"
          className={`${inputClass} flex-1`}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="min-h-9 rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-9 px-2 text-sm text-[var(--app-muted)]"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 6: Implement `src/components/tasks/LocalTaskList.tsx`**

```tsx
import { useMutation, useQuery } from 'convex/react'
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Pill, SurfaceCard } from '../app/ShellPrimitives'
import { TaskEditor, type TaskEditorValues } from './TaskEditor'
import { TaskRow } from './TaskRow'

const iconButtonClass =
  'inline-flex items-center text-[var(--app-muted)] disabled:opacity-30'

export interface LocalTaskListProps {
  listId: Id<'taskLists'>
  name: string
  onRemoveList: () => void
}

export function LocalTaskList({ listId, name, onRemoveList }: LocalTaskListProps) {
  const tasks = useQuery(api.tasks.listByList, { listId })
  const addTask = useMutation(api.tasks.add)
  const updateTask = useMutation(api.tasks.update)
  const toggleDone = useMutation(api.tasks.toggleDone)
  const removeTask = useMutation(api.tasks.remove)
  const move = useMutation(api.tasks.move)
  const [quickTitle, setQuickTitle] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [editingId, setEditingId] = useState<Id<'tasks'> | null>(null)

  async function quickAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = quickTitle.trim()
    if (!trimmed) return
    setQuickTitle('')
    await addTask({ listId, title: trimmed })
  }

  async function detailedAdd(values: TaskEditorValues) {
    setShowDetails(false)
    await addTask({ listId, ...values })
  }

  async function saveEdit(taskId: Id<'tasks'>, values: TaskEditorValues) {
    setEditingId(null)
    await updateTask({
      taskId,
      title: values.title,
      dueDate: values.dueDate ?? null,
      priority: values.priority ?? null,
      labels: values.labels ?? null,
    })
  }

  return (
    <SurfaceCard>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="m-0 text-base font-semibold">{name}</h3>
        <div className="flex items-center gap-2">
          <Pill>Local</Pill>
          <button
            type="button"
            aria-label={`Delete list ${name}`}
            className={iconButtonClass}
            onClick={onRemoveList}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <form onSubmit={quickAdd} className="mb-1 flex gap-2">
        <input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Add a task…"
          aria-label={`New task in ${name}`}
          className="min-h-9 flex-1 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-transparent px-3 text-sm"
        />
        <button
          type="submit"
          aria-label="Add task"
          className="inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
      <button
        type="button"
        className="mb-2 text-xs text-[var(--app-muted)]"
        onClick={() => setShowDetails((s) => !s)}
      >
        {showDetails ? 'Hide details' : 'Add with details…'}
      </button>
      {showDetails && (
        <TaskEditor
          submitLabel="Add task"
          onSubmit={(values) => void detailedAdd(values)}
          onCancel={() => setShowDetails(false)}
        />
      )}

      {tasks?.map((t, i) =>
        editingId === t._id ? (
          <TaskEditor
            key={t._id}
            initial={{
              title: t.title,
              dueDate: t.dueDate,
              priority: t.priority,
              labels: t.labels,
            }}
            submitLabel="Save"
            onSubmit={(values) => void saveEdit(t._id, values)}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <TaskRow
            key={t._id}
            task={{
              externalId: t._id,
              title: t.title,
              done: t.done,
              dueDate: t.dueDate,
              priority: t.priority,
              labels: t.labels,
            }}
            onToggle={() => void toggleDone({ taskId: t._id })}
            actions={
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`Move ${t.title} up`}
                  className={iconButtonClass}
                  disabled={i === 0}
                  onClick={() => void move({ taskId: t._id, direction: 'up' })}
                >
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${t.title} down`}
                  className={iconButtonClass}
                  disabled={i === tasks.length - 1}
                  onClick={() =>
                    void move({ taskId: t._id, direction: 'down' })
                  }
                >
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Edit ${t.title}`}
                  className={iconButtonClass}
                  onClick={() => setEditingId(t._id)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${t.title}`}
                  className={iconButtonClass}
                  onClick={() => void removeTask({ taskId: t._id })}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
            }
          />
        ),
      )}
      {tasks?.length === 0 && (
        <p className="m-0 text-sm text-[var(--app-muted)]">No tasks yet.</p>
      )}
    </SurfaceCard>
  )
}
```

- [ ] **Step 7: Implement `src/components/tasks/ExternalTaskList.tsx`**

```tsx
import { Link } from '@tanstack/react-router'
import { useAction } from 'convex/react'
import { RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { UnifiedTask } from '../../../convex/lib/taskProviders/types'
import { Pill, SurfaceCard } from '../app/ShellPrimitives'
import { TaskRow } from './TaskRow'

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; tasks: UnifiedTask[] }
  | { status: 'reconnect'; provider: 'notion' | 'todoist' }
  | { status: 'error'; message: string }

const PROVIDER_LABELS = { notion: 'Notion', todoist: 'Todoist' } as const

export interface ExternalTaskListProps {
  listId: Id<'taskLists'>
  name: string
  provider: 'notion' | 'todoist'
  onRemoveList: () => void
}

export function ExternalTaskList({
  listId,
  name,
  provider,
  onRemoveList,
}: ExternalTaskListProps) {
  const getTasks = useAction(api.taskLists.getTasks)
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      setState(await getTasks({ listId }))
    } catch {
      setState({ status: 'error', message: 'Could not load this list.' })
    }
  }, [getTasks, listId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SurfaceCard>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="m-0 text-base font-semibold">{name}</h3>
        <div className="flex items-center gap-2">
          <Pill>{PROVIDER_LABELS[provider]}</Pill>
          <button
            type="button"
            aria-label={`Refresh ${name}`}
            className="inline-flex items-center text-[var(--app-muted)]"
            onClick={() => void load()}
            disabled={state.status === 'loading'}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Delete list ${name}`}
            className="inline-flex items-center text-[var(--app-muted)]"
            onClick={onRemoveList}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {state.status === 'loading' && (
        <div className="grid gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-6 animate-pulse rounded bg-[var(--app-surface-muted)]"
            />
          ))}
        </div>
      )}
      {state.status === 'reconnect' && (
        <p className="m-0 text-sm text-[var(--app-muted)]">
          The {PROVIDER_LABELS[state.provider]} connection needs to be
          reconnected.{' '}
          <Link to="/settings" className="font-semibold">
            Go to settings
          </Link>
        </p>
      )}
      {state.status === 'error' && (
        <p className="m-0 text-sm text-[var(--app-muted)]">
          {state.message}{' '}
          <button
            type="button"
            className="font-semibold"
            onClick={() => void load()}
          >
            Retry
          </button>
        </p>
      )}
      {state.status === 'ok' &&
        (state.tasks.length === 0 ? (
          <p className="m-0 text-sm text-[var(--app-muted)]">
            No open tasks in this {PROVIDER_LABELS[provider]} list.
          </p>
        ) : (
          state.tasks.map((t) => <TaskRow key={t.externalId} task={t} />)
        ))}
    </SurfaceCard>
  )
}
```

- [ ] **Step 8: Typecheck, lint, run all tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/tasks
git commit -m "feat(tasks): TaskRow, TaskEditor, local and external list components"
```

---

### Task 9: Add-list flow, Tasks page, module goes live

**Files:**
- Create: `src/components/tasks/AddListFlow.tsx`
- Modify: `src/routes/_app/tasks.tsx` (replace placeholder entirely)
- Modify: `src/lib/modules.ts:82` (tasks `status: 'placeholder'` → `'live'`)

- [ ] **Step 1: Implement `src/components/tasks/AddListFlow.tsx`**

```tsx
import { useAction, useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type {
  PropertyMapping,
  ProviderSource,
  SourceProperty,
} from '../../../convex/lib/taskProviders/types'
import type { ExternalProvider } from '../../lib/oauth'
import {
  errorMessage,
  useConnectProvider,
} from '../settings/ConnectionsSettings'
import { SurfaceCard } from '../app/ShellPrimitives'

type Step =
  | { kind: 'provider' }
  | { kind: 'local-name' }
  | { kind: 'source'; provider: ExternalProvider; sources: ProviderSource[] }
  | {
      kind: 'notion-mapping'
      source: ProviderSource
      schema: SourceProperty[]
    }

const buttonClass =
  'inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold'
const inputClass =
  'min-h-9 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-transparent px-2 text-sm'

export function AddListFlow({ onDone }: { onDone: () => void }) {
  const connections = useQuery(api.integrations.listConnections)
  const listSources = useAction(api.integrations.listSources)
  const getSourceSchema = useAction(api.integrations.getSourceSchema)
  const createList = useMutation(api.taskLists.create)
  const connect = useConnectProvider('/tasks')

  const [step, setStep] = useState<Step>({ kind: 'provider' })
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<void>) {
    setError(null)
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      setError(errorMessage(e, 'Something went wrong — try again.'))
    } finally {
      setBusy(false)
    }
  }

  function connectionFor(provider: ExternalProvider) {
    return connections?.find((c) => c.provider === provider)
  }

  async function pickExternal(provider: ExternalProvider) {
    await run(async () => {
      const sources = await listSources({ provider })
      setStep({ kind: 'source', provider, sources })
    })
  }

  async function pickSource(provider: ExternalProvider, source: ProviderSource) {
    setName(source.name)
    if (provider === 'todoist') {
      await run(async () => {
        const conn = connectionFor('todoist')
        if (!conn) throw new Error('No connection')
        await createList({
          name: source.name,
          provider: 'todoist',
          providerConfig: { connectionId: conn._id, sourceId: source.id },
        })
        onDone()
      })
      return
    }
    await run(async () => {
      const schema = await getSourceSchema({ provider, sourceId: source.id })
      setStep({ kind: 'notion-mapping', source, schema })
    })
  }

  async function createLocal(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    await run(async () => {
      await createList({ name: trimmed, provider: 'local' })
      onDone()
    })
  }

  async function createNotion(
    source: ProviderSource,
    mapping: PropertyMapping,
  ) {
    await run(async () => {
      const conn = connectionFor('notion')
      if (!conn) throw new Error('No connection')
      await createList({
        name: name.trim() || source.name,
        provider: 'notion',
        providerConfig: {
          connectionId: conn._id,
          sourceId: source.id,
          propertyMapping: mapping,
        },
      })
      onDone()
    })
  }

  return (
    <SurfaceCard>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="m-0 text-base font-semibold">Add a list</h3>
        <button
          type="button"
          className="text-sm text-[var(--app-muted)]"
          onClick={onDone}
        >
          Cancel
        </button>
      </div>
      {error && <p className="m-0 mb-2 text-sm text-red-600">{error}</p>}

      {step.kind === 'provider' && (
        <div className="grid gap-2">
          <button
            type="button"
            className={buttonClass}
            onClick={() => setStep({ kind: 'local-name' })}
          >
            Local list — created and edited here
          </button>
          {(['notion', 'todoist'] as const).map((provider) =>
            connectionFor(provider) ? (
              <button
                key={provider}
                type="button"
                className={buttonClass}
                disabled={busy}
                onClick={() => void pickExternal(provider)}
              >
                {provider === 'notion' ? 'Notion' : 'Todoist'} — read-only
                mirror
              </button>
            ) : (
              <button
                key={provider}
                type="button"
                className={buttonClass}
                disabled={busy}
                onClick={() => void run(() => connect(provider))}
              >
                Connect {provider === 'notion' ? 'Notion' : 'Todoist'} first…
              </button>
            ),
          )}
        </div>
      )}

      {step.kind === 'local-name' && (
        <form onSubmit={(e) => void createLocal(e)} className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="List name"
            aria-label="List name"
            className={`${inputClass} flex-1`}
          />
          <button type="submit" className={buttonClass} disabled={busy}>
            Create
          </button>
        </form>
      )}

      {step.kind === 'source' && (
        <div className="grid gap-2">
          <p className="m-0 text-sm text-[var(--app-muted)]">
            {step.provider === 'notion'
              ? 'Pick the Notion database to mirror:'
              : 'Pick the Todoist project to mirror:'}
          </p>
          {step.sources.length === 0 && (
            <p className="m-0 text-sm text-[var(--app-muted)]">
              Nothing found — make sure the connection has access to at least
              one {step.provider === 'notion' ? 'database' : 'project'}.
            </p>
          )}
          {step.sources.map((source) => (
            <button
              key={source.id}
              type="button"
              className={buttonClass}
              disabled={busy}
              onClick={() => void pickSource(step.provider, source)}
            >
              {source.name}
            </button>
          ))}
        </div>
      )}

      {step.kind === 'notion-mapping' && (
        <NotionMappingForm
          schema={step.schema}
          name={name}
          onNameChange={setName}
          busy={busy}
          onSubmit={(mapping) => void createNotion(step.source, mapping)}
        />
      )}
    </SurfaceCard>
  )
}

function NotionMappingForm({
  schema,
  name,
  onNameChange,
  busy,
  onSubmit,
}: {
  schema: SourceProperty[]
  name: string
  onNameChange: (name: string) => void
  busy: boolean
  onSubmit: (mapping: PropertyMapping) => void
}) {
  const titleProps = schema.filter((p) => p.type === 'title')
  const doneProps = schema.filter(
    (p) => p.type === 'checkbox' || p.type === 'status',
  )
  const dateProps = schema.filter((p) => p.type === 'date')
  const selectProps = schema.filter((p) => p.type === 'select')
  const multiSelectProps = schema.filter((p) => p.type === 'multi_select')

  const [title, setTitle] = useState(titleProps[0]?.name ?? '')
  const [done, setDone] = useState(doneProps[0]?.name ?? '')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('')
  const [labels, setLabels] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title || !done) return
    onSubmit({
      title,
      done,
      dueDate: dueDate || undefined,
      priority: priority || undefined,
      labels: labels || undefined,
    })
  }

  const selectClass =
    'min-h-9 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-transparent px-2 text-sm'

  function MappingSelect({
    label,
    value,
    onChange,
    options,
    required,
  }: {
    label: string
    value: string
    onChange: (v: string) => void
    options: SourceProperty[]
    required?: boolean
  }) {
    return (
      <label className="grid gap-1 text-sm">
        {label}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={selectClass}
        >
          {!required && <option value="">Not mapped</option>}
          {options.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <p className="m-0 text-sm text-[var(--app-muted)]">
        Map this database's properties so gather knows how to read it. A
        status property counts as done when it is named Done, Complete, or
        Completed.
      </p>
      <label className="grid gap-1 text-sm">
        List name
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className={selectClass}
          aria-label="List name"
        />
      </label>
      <MappingSelect
        label="Title property"
        value={title}
        onChange={setTitle}
        options={titleProps}
        required
      />
      <MappingSelect
        label="Done property (checkbox or status)"
        value={done}
        onChange={setDone}
        options={doneProps}
        required
      />
      <MappingSelect
        label="Due date property"
        value={dueDate}
        onChange={setDueDate}
        options={dateProps}
      />
      <MappingSelect
        label="Priority property (select named 1–4 or P1–P4)"
        value={priority}
        onChange={setPriority}
        options={selectProps}
      />
      <MappingSelect
        label="Labels property"
        value={labels}
        onChange={setLabels}
        options={multiSelectProps}
      />
      <button
        type="submit"
        disabled={busy || !title || !done}
        className="inline-flex min-h-9 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold"
      >
        Create linked list
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Replace `src/routes/_app/tasks.tsx`**

```tsx
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { SurfaceCard } from '../../components/app/ShellPrimitives'
import { AddListFlow } from '../../components/tasks/AddListFlow'
import { ExternalTaskList } from '../../components/tasks/ExternalTaskList'
import { LocalTaskList } from '../../components/tasks/LocalTaskList'

export const Route = createFileRoute('/_app/tasks')({
  component: TasksPage,
})

function TasksPage() {
  const lists = useQuery(api.taskLists.list)
  const removeList = useMutation(api.taskLists.remove)
  const [adding, setAdding] = useState(false)

  function confirmRemove(listId: Id<'taskLists'>, name: string) {
    if (window.confirm(`Delete the list "${name}"?`)) {
      void removeList({ listId })
    }
  }

  if (lists === null) {
    return (
      <div className="mx-auto max-w-md">
        <SurfaceCard>
          <div className="grid gap-2 text-center">
            <h2 className="m-0 text-base font-semibold">
              Pick a default group first
            </h2>
            <p className="m-0 text-sm text-[var(--app-muted)]">
              Task lists belong to a group. Choose or create one, then come
              back.
            </p>
            <Link to="/groups" className="text-sm font-semibold">
              Go to groups
            </Link>
          </div>
        </SurfaceCard>
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-2xl font-semibold">Tasks</h2>
          <p className="mt-1 text-sm text-[var(--app-muted)]">
            Shared lists — local ones live here, linked ones mirror Notion or
            Todoist.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex min-h-9 items-center gap-2 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add list
        </button>
      </div>

      {adding && <AddListFlow onDone={() => setAdding(false)} />}

      {lists === undefined ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface-muted)]"
            />
          ))}
        </div>
      ) : lists.length === 0 && !adding ? (
        <SurfaceCard>
          <div className="grid gap-3 text-center">
            <h3 className="m-0 text-base font-semibold">No lists yet</h3>
            <p className="m-0 text-sm text-[var(--app-muted)]">
              Create a local list, or link one from Notion or Todoist.
            </p>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mx-auto inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold"
            >
              Add your first list
            </button>
          </div>
        </SurfaceCard>
      ) : (
        <div className="grid items-start gap-3 md:grid-cols-2">
          {lists.map((l) =>
            l.provider === 'local' ? (
              <LocalTaskList
                key={l._id}
                listId={l._id}
                name={l.name}
                onRemoveList={() => confirmRemove(l._id, l.name)}
              />
            ) : (
              <ExternalTaskList
                key={l._id}
                listId={l._id}
                name={l.name}
                provider={l.provider}
                onRemoveList={() => confirmRemove(l._id, l.name)}
              />
            ),
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Flip the module to live**

In `src/lib/modules.ts`, in the `tasks` entry (around line 82), change:

```ts
    status: 'placeholder',
```
to
```ts
    status: 'live',
```

- [ ] **Step 4: Typecheck, lint, run all tests**

Run: `pnpm generate-routes && pnpm typecheck && pnpm lint && pnpm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/AddListFlow.tsx src/routes/_app/tasks.tsx src/lib/modules.ts src/routeTree.gen.ts
git commit -m "feat(tasks): add-list flow and live Tasks page"
```

---

### Task 10: Env documentation, full verification

**Files:**
- Modify: `CLAUDE.md` (Env vars section)

- [ ] **Step 1: Document the new Convex env vars in `CLAUDE.md`**

In the "Env vars" section, after the `ANTHROPIC_API_KEY` sentence, add:

```markdown
`NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` and `TODOIST_CLIENT_ID` /
`TODOIST_CLIENT_SECRET` — OAuth credentials for the Tasks module's external
list providers; optional (without them, connecting that provider fails with a
clear "not configured" error and local lists work normally). Each provider's
OAuth app must register the redirect URI `<app-origin>/integrations/callback`
(e.g. `http://localhost:3000/integrations/callback` for dev).
```

- [ ] **Step 2: Full verification suite**

Run: `pnpm check && pnpm typecheck && pnpm test && pnpm build`
Expected: all PASS.

- [ ] **Step 3: Manual verification (no OAuth apps needed)**

Use the `verify` skill / dev preview (`pnpm dev:all` via preview_start):
1. `/tasks` shows the empty state (or the pick-a-default-group prompt).
2. Create a local list; add tasks (quick add and "Add with details…" with priority/labels/due date); toggle done (moves below open tasks); edit a task; move up/down; delete a task; delete the list.
3. `/settings` shows the Connections section with Notion and Todoist "Not connected" and working Connect buttons (clicking surfaces the "not configured" ConvexError if env vars are unset — that's the expected message, not a crash).
4. Dashboard/sidebar shows Tasks as live.

External-provider flows (connect Notion/Todoist, link a database/project, refresh, reconnect-after-disconnect) require real OAuth apps:
- Notion: create a **public integration** at notion.so/my-integrations with redirect URI `<origin>/integrations/callback`; set `NOTION_CLIENT_ID`/`NOTION_CLIENT_SECRET` via `pnpm exec convex env set`.
- Todoist: create an app at developer.todoist.com/appconsole with the same redirect URI; set `TODOIST_CLIENT_ID`/`TODOIST_CLIENT_SECRET`.
Verify: connect → pick source → (Notion) map properties → list renders read-only rows with link-out; Refresh re-pulls; Settings → Disconnect → list shows the reconnect prompt; reconnect restores it.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document Notion/Todoist OAuth env vars for tasks module"
```
