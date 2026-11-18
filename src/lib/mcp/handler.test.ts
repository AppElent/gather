// @vitest-environment node
import { getFunctionName } from 'convex/server'
import { ConvexError } from 'convex/values'
import { describe, expect, it } from 'vitest'
import type { McpAccess } from './auth'
import { type GatherMcpOptions, handleGatherMcpRequest } from './handler'
import { GATHER_MCP_TOOLS } from './server'
import { type GatherBackend, GROUP_NOT_FOUND } from './tools/define'

const ORIGIN = 'https://gather.example'
const READ_WRITE = ['gather:read', 'gather:write']
const KEY = '7f9c2ba4-e88f-11ee-b9d1-0242ac120002'

type Call = { kind: 'query' | 'mutation'; name: string; args: unknown }

const GROUPS = [
  {
    _id: 'group_home',
    _creationTime: 1,
    name: 'Home',
    slug: 'home',
    inviteCode: 'secret-invite',
    role: 'admin',
    imageUrl: null,
  },
]

function fakeBackend(
  responses: Record<string, (args: never) => unknown> = {},
): GatherBackend & { calls: Call[] } {
  const calls: Call[] = []
  const all: Record<string, (args: never) => unknown> = {
    'groups:myGroups': () => GROUPS,
    ...responses,
  }
  const run = (kind: Call['kind']) => async (reference: never, args: never) => {
    const name = getFunctionName(reference)
    calls.push({ kind, name, args })
    const respond = all[name]
    if (!respond) throw new Error(`unexpected call ${name}`)
    return respond(args)
  }
  return {
    calls,
    query: run('query') as GatherBackend['query'],
    mutation: run('mutation') as GatherBackend['mutation'],
  }
}

function options(
  backend: GatherBackend,
  scopes: string[] = READ_WRITE,
): GatherMcpOptions {
  return {
    issuer: 'https://clerk.example',
    verifyToken: async (token, resource): Promise<McpAccess | undefined> =>
      token === 'good' && resource === `${ORIGIN}/mcp`
        ? { userId: 'user_1', scopes: new Set(scopes), token }
        : undefined,
    createBackend: () => backend,
    fetchUserInfo: async () => ({ name: 'Ada', email: 'ada@example.com' }),
    now: () => new Date('2026-11-17T12:00:00Z'),
  }
}

function rpc(
  method: string,
  params?: unknown,
  init: { token?: string | null; origin?: string; httpMethod?: string } = {},
) {
  const headers = new Headers({
    accept: 'application/json, text/event-stream',
    'content-type': 'application/json',
  })
  const token = init.token === undefined ? 'good' : init.token
  if (token) headers.set('authorization', `Bearer ${token}`)
  if (init.origin) headers.set('origin', init.origin)
  const httpMethod = init.httpMethod ?? 'POST'
  return new Request(`${ORIGIN}/mcp`, {
    method: httpMethod,
    headers,
    body:
      httpMethod === 'POST'
        ? JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
        : undefined,
  })
}

async function result<T>(response: Response) {
  expect(response.status).toBe(200)
  return ((await response.json()) as { result: T }).result
}

type ToolResult = {
  isError?: boolean
  content: { text: string }[]
  structuredContent?: Record<string, unknown>
}

async function callTool(
  backend: GatherBackend,
  name: string,
  args: Record<string, unknown>,
  scopes?: string[],
) {
  return result<ToolResult>(
    await handleGatherMcpRequest(
      rpc('tools/call', { name, arguments: args }),
      options(backend, scopes),
    ),
  )
}

async function toolNames(scopes: string[]) {
  const listed = await result<{ tools: { name: string }[] }>(
    await handleGatherMcpRequest(
      rpc('tools/list'),
      options(fakeBackend(), scopes),
    ),
  )
  return listed.tools.map((t) => t.name).sort()
}

const readTools = GATHER_MCP_TOOLS.filter((t) => t.access === 'read')
  .map((t) => t.name)
  .sort()

describe('Gather MCP endpoint', () => {
  it('challenges an unauthenticated request with resource metadata', async () => {
    const response = await handleGatherMcpRequest(
      rpc('initialize', {}, { token: null }),
      options(fakeBackend()),
    )
    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toContain(
      `resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/mcp"`,
    )
  })

  it('refuses an invalid or expired token as invalid_token', async () => {
    const response = await handleGatherMcpRequest(
      rpc('tools/list', {}, { token: 'expired' }),
      options(fakeBackend()),
    )
    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toContain(
      'error="invalid_token"',
    )
  })

  it('refuses a token without a Gather scope with 403 insufficient_scope', async () => {
    const response = await handleGatherMcpRequest(
      rpc('tools/list'),
      options(fakeBackend(), ['openid', 'profile', 'foundry:write']),
    )
    expect(response.status).toBe(403)
    expect(response.headers.get('www-authenticate')).toContain(
      'error="insufficient_scope"',
    )
  })

  it('allows only listed browser origins', async () => {
    const refused = await handleGatherMcpRequest(
      rpc('tools/list', {}, { origin: 'https://evil.example' }),
      options(fakeBackend()),
    )
    expect(refused.status).toBe(403)
    for (const origin of ['https://claude.ai', 'https://chatgpt.com', ORIGIN]) {
      const allowed = await handleGatherMcpRequest(
        rpc('tools/list', {}, { origin }),
        options(fakeBackend()),
      )
      expect(allowed.status).toBe(200)
      expect(allowed.headers.get('access-control-allow-origin')).toBe(origin)
    }
  })

  it('serves only POST and OPTIONS', async () => {
    const response = await handleGatherMcpRequest(
      rpc('', undefined, { httpMethod: 'GET' }),
      options(fakeBackend()),
    )
    expect(response.status).toBe(405)
  })

  it('initializes with Gather server info and instructions', async () => {
    const init = await result<{
      serverInfo: { name: string; icons?: { src: string }[] }
      instructions: string
    }>(
      await handleGatherMcpRequest(
        rpc('initialize', {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test', version: '1' },
        }),
        options(fakeBackend()),
      ),
    )
    expect(init.serverInfo.name).toBe('gather')
    // Gather's own icon, so clients do not guess one from the domain.
    expect(init.serverInfo.icons?.[0]?.src).toMatch(/\/favicon\.svg$/)
    expect(init.instructions).toContain('list_groups')
  })

  it('lists only read tools for a read-only token', async () => {
    expect(await toolNames(['gather:read'])).toEqual(readTools)
  })

  it('lists every tool for a write token, and no delete tool', async () => {
    const names = await toolNames(READ_WRITE)
    expect(names).toEqual(GATHER_MCP_TOOLS.map((t) => t.name).sort())
    expect(await toolNames(['gather:write'])).toEqual(names)
    expect(names.some((n) => /delete|remove/.test(n))).toBe(false)
  })

  it('gives every create tool a required idempotencyKey', async () => {
    const listed = await result<{
      tools: { name: string; inputSchema: { required?: string[] } }[]
    }>(
      await handleGatherMcpRequest(
        rpc('tools/list'),
        options(fakeBackend()),
      ),
    )
    const creates = listed.tools.filter((t) => t.name.startsWith('create_'))
    expect(creates.length).toBe(5)
    for (const tool of creates)
      expect(tool.inputSchema.required).toContain('idempotencyKey')
  })

  it('lists Groups by id, name and role and nothing else', async () => {
    const out = await callTool(fakeBackend(), 'list_groups', {})
    expect(out.structuredContent).toEqual({
      groups: [{ id: 'group_home', name: 'Home', role: 'admin' }],
    })
    expect(out.content[0].text).not.toContain('secret-invite')
  })

  it('calls Convex by the Group slug and strips private fields', async () => {
    const backend = fakeBackend({
      'notes:list': () => [
        {
          _id: 'note_1',
          _creationTime: 1,
          groupId: 'group_home',
          title: 'Wifi',
          body: 'hunter2',
          pinned: true,
          createdBy: 'user_internal',
          updatedAt: Date.parse('2026-11-01T10:00:00Z'),
          updatedByName: 'Ada',
          updatedByMe: true,
        },
      ],
    })
    const out = await callTool(backend, 'list_notes', { groupId: 'group_home' })
    expect(out.isError).toBeUndefined()
    expect(backend.calls.at(-1)).toMatchObject({
      name: 'notes:list',
      args: { groupSlug: 'home' },
    })
    expect(out.structuredContent).toEqual({
      notes: [
        {
          id: 'note_1',
          title: 'Wifi',
          body: 'hunter2',
          pinned: true,
          updatedAt: '2026-11-01T10:00:00.000Z',
          updatedByName: 'Ada',
        },
      ],
      total: 1,
    })
    expect(out.content[0].text).not.toContain('user_internal')
  })

  it('refuses a Group the caller is not in like a missing one, before any data call', async () => {
    const backend = fakeBackend()
    const out = await callTool(backend, 'list_notes', { groupId: 'group_other' })
    expect(out.isError).toBe(true)
    expect(out.content[0].text).toBe(GROUP_NOT_FOUND)
    expect(backend.calls.map((c) => c.name)).toEqual(['groups:myGroups'])
  })

  it('reads a Convex Group refusal as the same missing Group', async () => {
    for (const refusal of ['Not a member of that group', 'No group has that slug']) {
      const out = await callTool(
        fakeBackend({
          'notes:list': () => {
            throw new ConvexError(refusal)
          },
        }),
        'list_notes',
        { groupId: 'group_home' },
      )
      expect(out.content[0].text).toBe(GROUP_NOT_FOUND)
    }
  })

  it('passes the idempotency key to Convex on create', async () => {
    const backend = fakeBackend({ 'tasks:add': () => 'task_1' })
    const out = await callTool(backend, 'create_task', {
      groupId: 'group_home',
      listId: 'list_1',
      idempotencyKey: KEY,
      title: 'Buy milk',
      priority: 2,
    })
    expect(out.structuredContent).toEqual({ taskId: 'task_1' })
    expect(backend.calls.at(-1)).toEqual({
      kind: 'mutation',
      name: 'tasks:add',
      args: {
        groupSlug: 'home',
        listId: 'list_1',
        idempotencyKey: KEY,
        title: 'Buy milk',
        priority: 2,
      },
    })
  })

  it('refuses a write tool on a read-only token as an unknown tool', async () => {
    const backend = fakeBackend()
    const out = await callTool(
      backend,
      'create_note',
      { groupId: 'group_home', idempotencyKey: KEY, title: 'x', body: 'y' },
      ['gather:read'],
    )
    expect(out.isError).toBe(true)
    expect(backend.calls).toEqual([])
  })

  it('answers an unknown tool with an error', async () => {
    const out = await callTool(fakeBackend(), 'delete_everything', {})
    expect(out.isError).toBe(true)
    expect(out.content[0].text).toMatch(/not found/i)
  })

  it('refuses invalid arguments before calling Convex', async () => {
    const backend = fakeBackend()
    const out = await callTool(backend, 'create_event', {
      groupId: 'group_home',
      calendarId: 'cal_1',
      idempotencyKey: 'short',
      title: 'Dentist',
      date: '17-11-2026',
    })
    expect(out.isError).toBe(true)
    expect(backend.calls).toEqual([])
  })

  it('reports a fault generically and keeps its text from the agent', async () => {
    const out = await callTool(
      fakeBackend({
        'notes:list': () => {
          throw new Error('connect ECONNREFUSED 10.0.0.1 token=sk_live_x')
        },
      }),
      'list_notes',
      { groupId: 'group_home' },
    )
    expect(out.isError).toBe(true)
    expect(out.content[0].text).toBe('The Gather tool failed.')
  })

  it('reads a calendar refusal the same for missing and elsewhere', async () => {
    const texts = new Set<string>()
    for (const kind of ['calendar:deleted', 'calendar:not-found']) {
      const out = await callTool(
        fakeBackend({
          'calendar:getCalendarEvent': () => {
            throw new ConvexError({ kind })
          },
        }),
        'update_event',
        { groupId: 'group_home', eventId: 'event_1', title: 'New' },
      )
      texts.add(out.content[0].text)
    }
    expect(texts.size).toBe(1)
  })

  it('updates an event from its current revision, keeping what was not passed', async () => {
    const backend = fakeBackend({
      'calendar:getCalendarEvent': () => ({
        _id: 'event_1',
        id: 'event_1',
        calendarId: 'cal_1',
        calendarName: 'Family',
        color: 'home',
        title: 'Dentist',
        date: '2026-11-20',
        allDay: false,
        startMinutes: 540,
        endMinutes: 600,
        assigneeIds: ['user_a'],
        location: 'Main St',
        notes: '',
        revision: 3,
      }),
      'calendar:updateEvent': () => ({ id: 'event_1', revision: 4 }),
    })
    const out = await callTool(backend, 'update_event', {
      groupId: 'group_home',
      eventId: 'event_1',
      start: '10:30',
      end: '11:00',
    })
    expect(out.isError).toBeUndefined()
    expect(backend.calls.at(-1)?.args).toEqual({
      groupSlug: 'home',
      id: 'event_1',
      expectedRevision: 3,
      calendarId: 'cal_1',
      title: 'Dentist',
      date: '2026-11-20',
      allDay: false,
      startMinutes: 630,
      endMinutes: 660,
      assigneeIds: ['user_a'],
      location: 'Main St',
      notes: null,
    })
  })

  it('will not update a recipe that was only shared into the Group', async () => {
    const backend = fakeBackend({
      'recipes:get': () => ({
        _id: 'recipe_1',
        title: 'Soup',
        ingredients: [],
        steps: [],
        tags: [],
        canEdit: false,
        homeGroupSlug: 'club',
        sharedGroups: [],
      }),
    })
    const out = await callTool(backend, 'update_recipe', {
      groupId: 'group_home',
      recipeId: 'recipe_1',
      title: 'Better soup',
    })
    expect(out.content[0].text).toBe('Recipe not found.')
    expect(backend.calls.some((c) => c.name === 'recipes:update')).toBe(false)
  })

  it('updates a recipe from its home Group, sending unchanged fields back', async () => {
    const recipe = {
      _id: 'recipe_1',
      title: 'Soup',
      description: 'Warm',
      ingredients: ['water'],
      steps: ['boil'],
      tags: ['winter'],
      servings: 2,
      rating: 4,
      canEdit: true,
      homeGroupSlug: 'home',
      sharedGroups: [],
    }
    const backend = fakeBackend({
      'recipes:get': () => recipe,
      'recipes:update': () => null,
    })
    const out = await callTool(backend, 'update_recipe', {
      groupId: 'group_home',
      recipeId: 'recipe_1',
      title: 'Better soup',
      description: null,
      rating: null,
    })
    expect(out.isError).toBeUndefined()
    expect(backend.calls.at(-1)?.args).toEqual({
      id: 'recipe_1',
      title: 'Better soup',
      description: '',
      ingredients: ['water'],
      steps: ['boil'],
      tags: ['winter'],
      servings: 2,
      rating: null,
    })
  })

  it('will not write a recipe from a Group it was only shared into, even for a home Member', async () => {
    const backend = fakeBackend({
      'recipes:get': () => ({
        _id: 'recipe_1',
        title: 'Soup',
        ingredients: [],
        steps: [],
        tags: [],
        canEdit: true,
        homeGroupSlug: 'club',
        sharedGroups: [],
      }),
    })
    const out = await callTool(backend, 'update_recipe', {
      groupId: 'group_home',
      recipeId: 'recipe_1',
      title: 'Better soup',
    })
    expect(out.content[0].text).toBe('Recipe not found.')
  })

  it('marks a task done by setting it, not toggling', async () => {
    const backend = fakeBackend({ 'tasks:update': () => null })
    await callTool(backend, 'update_task', {
      groupId: 'group_home',
      taskId: 'task_1',
      done: true,
    })
    expect(backend.calls.at(-1)?.args).toEqual({
      groupSlug: 'home',
      taskId: 'task_1',
      done: true,
    })
  })

  it('serves the three views as MCP Apps resources', async () => {
    const listed = await result<{
      tools: { name: string; _meta?: { ui?: { resourceUri?: string } } }[]
    }>(await handleGatherMcpRequest(rpc('tools/list'), options(fakeBackend())))
    const views = Object.fromEntries(
      listed.tools
        .filter((t) => t._meta?.ui?.resourceUri)
        .map((t) => [t.name, t._meta?.ui?.resourceUri]),
    )
    expect(views).toEqual({
      show_week_agenda: 'ui://gather/week-agenda',
      show_task_list: 'ui://gather/task-list',
      show_recipe: 'ui://gather/recipe-card',
    })
    const read = await result<{
      contents: {
        mimeType: string
        text: string
        _meta: { ui: { domain: string } }
      }[]
    }>(
      await handleGatherMcpRequest(
        rpc('resources/read', { uri: 'ui://gather/task-list' }),
        options(fakeBackend(), ['gather:read']),
      ),
    )
    const [content] = read.contents
    expect(content.mimeType).toContain('mcp-app')
    expect(content.text).toContain('data-view="task-list"')
    expect(content._meta.ui.domain).toMatch(/^[0-9a-f]{32}\.claudemcpcontent\.com$/)
  })

  it('builds a Monday-to-Sunday agenda from every calendar', async () => {
    const backend = fakeBackend({
      'calendar:listCalendars': () => ({
        page: [{ _id: 'cal_1', name: 'Family', color: 'home' }],
        isDone: true,
        continueCursor: '',
      }),
      'calendar:listEvents': () => ({
        page: [
          {
            _id: 'event_1',
            calendarId: 'cal_1',
            calendarName: 'Family',
            title: 'Dentist',
            date: '2026-11-19',
            allDay: false,
            startMinutes: 540,
            endMinutes: 600,
            location: '',
            notes: '',
          },
        ],
        isDone: true,
        continueCursor: '',
      }),
    })
    const out = await callTool(backend, 'show_week_agenda', {
      groupId: 'group_home',
    })
    const agenda = out.structuredContent as {
      weekStart: string
      isCurrentWeek: boolean
      days: { date: string; events: { title: string; start?: string }[] }[]
    }
    expect(agenda.weekStart).toBe('2026-11-16')
    expect(agenda.isCurrentWeek).toBe(true)
    expect(agenda.days).toHaveLength(7)
    expect(agenda.days[3]).toEqual({
      date: '2026-11-19',
      events: [
        {
          id: 'event_1',
          calendar: 'Family',
          title: 'Dentist',
          date: '2026-11-19',
          allDay: false,
          start: '09:00',
          end: '10:00',
        },
      ],
    })
    expect(backend.calls.at(-1)?.args).toMatchObject({
      from: '2026-11-16',
      toExclusive: '2026-11-23',
    })
  })

  it('shows a task list as writable only with the write scope', async () => {
    const backend = () =>
      fakeBackend({
        'taskLists:list': () => [
          { _id: 'list_1', name: 'Groceries', provider: 'local', writable: true },
        ],
        'tasks:listByList': () => [
          { _id: 'task_1', title: 'Milk', done: false, createdBy: 'user_x' },
        ],
      })
    const args = { groupId: 'group_home', listId: 'list_1' }
    const writer = await callTool(backend(), 'show_task_list', args)
    expect(writer.structuredContent).toMatchObject({
      canWrite: true,
      tasks: [{ id: 'task_1', title: 'Milk', done: false }],
    })
    expect(writer.content[0].text).not.toContain('user_x')
    const reader = await callTool(backend(), 'show_task_list', args, [
      'gather:read',
    ])
    expect(reader.structuredContent).toMatchObject({
      canWrite: false,
      readOnlyReason: 'scope',
    })
  })

  it('lists the meal plan by name, with servings and busy evenings, without user ids', async () => {
    const backend = fakeBackend({
      'mealPlan:week': () => ({
        meals: [
          {
            _id: 'meal_1',
            date: '2026-11-25',
            slot: 'dinner',
            recipeId: 'recipe_1',
            title: 'Snert',
            prepMinutes: 45,
            eaterIds: undefined,
            imageUrl: null,
          },
        ],
        members: [
          { userId: 'user_a', name: 'Daan' },
          { userId: 'user_b', name: 'Sanne' },
        ],
        events: [
          {
            _id: 'event_1',
            date: '2026-11-25',
            title: 'Zwemles',
            startMinutes: 1080,
            endMinutes: 1140,
            assigneeIds: ['user_a'],
          },
        ],
        preferences: {
          memberDefaults: [
            { userId: 'user_a', eatsByDefault: true },
            { userId: 'user_b', eatsByDefault: true },
          ],
          slots: {},
        },
        groceryListId: null,
      }),
      'mealPlan:candidates': () => ({
        recipes: [],
        mealEntries: [{ _id: 'entry_1', title: 'Pizza', prepMinutes: 15 }],
      }),
    })
    const out = await callTool(backend, 'list_meal_plan', {
      groupId: 'group_home',
      from: '2026-11-23',
      to: '2026-11-30',
    })
    expect(out.structuredContent).toMatchObject({
      meals: [
        {
          id: 'meal_1',
          slot: 'dinner',
          title: 'Snert',
          servings: 1,
          eating: ['Sanne'],
        },
      ],
      busyEvenings: [
        { date: '2026-11-25', title: 'Zwemles', start: '18:00', away: ['Daan'] },
      ],
      quickMeals: [{ id: 'entry_1', title: 'Pizza', prepMinutes: 15 }],
    })
    expect(out.content[0].text).not.toContain('user_a')
    expect(backend.calls.find((c) => c.name === 'mealPlan:week')?.args).toEqual({
      groupSlug: 'home',
      from: '2026-11-23',
      to: '2026-11-29',
    })
  })

  it('refuses a meal plan range that is backwards or longer than 31 days', async () => {
    for (const to of ['2026-11-23', '2026-12-25']) {
      const backend = fakeBackend()
      const out = await callTool(backend, 'list_meal_plan', {
        groupId: 'group_home',
        from: '2026-11-23',
        to,
      })
      expect(out.isError).toBe(true)
      expect(backend.calls.some((c) => c.name.startsWith('mealPlan:'))).toBe(
        false,
      )
    }
  })

  it('plans a quick meal into one slot and refuses both or neither candidate', async () => {
    const backend = fakeBackend({ 'mealPlan:plan': () => 'meal_9' })
    const out = await callTool(backend, 'plan_meal', {
      groupId: 'group_home',
      date: '2026-11-26',
      slot: 'lunch',
      quickMealId: 'entry_1',
      servings: 3,
    })
    expect(out.structuredContent).toEqual({ mealId: 'meal_9' })
    expect(backend.calls.at(-1)).toEqual({
      kind: 'mutation',
      name: 'mealPlan:plan',
      args: {
        groupSlug: 'home',
        date: '2026-11-26',
        slot: 'lunch',
        mealEntryId: 'entry_1',
        servings: 3,
        replace: false,
      },
    })
    for (const pick of [{}, { recipeId: 'recipe_1', quickMealId: 'entry_1' }]) {
      const refused = await callTool(fakeBackend(), 'plan_meal', {
        groupId: 'group_home',
        date: '2026-11-26',
        slot: 'dinner',
        ...pick,
      })
      expect(refused.isError).toBe(true)
    }
  })

  it('shows a recipe card and passes only web links to the view', async () => {
    const backend = fakeBackend({
      'recipes:get': () => ({
        _id: 'recipe_1',
        title: 'Snert',
        ingredients: ['500 g spliterwten'],
        steps: ['Koken'],
        tags: [],
        servings: 4,
        sourceUrl: 'javascript:alert(1)',
        imageUrl: null,
        canEdit: true,
        homeGroupSlug: 'club',
        homeGroupName: 'Kookclub',
        sharedGroups: [],
      }),
    })
    const out = await callTool(backend, 'show_recipe', {
      groupId: 'group_home',
      recipeId: 'recipe_1',
    })
    expect(out.structuredContent).toMatchObject({
      view: 'recipe-card',
      recipe: { title: 'Snert', servings: 4, sharedFrom: 'Kookclub' },
    })
    expect(
      (out.structuredContent as { recipe: { sourceUrl?: string } }).recipe
        .sourceUrl,
    ).toBeUndefined()
  })
})
