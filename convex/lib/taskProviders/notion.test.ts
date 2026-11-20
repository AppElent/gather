import { describe, expect, test, vi } from 'vitest'
import { mapNotionPage, notionAdapter, parentRelationOf } from './notion'
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
    expect(mapNotionPage(statusPage('In progress'), minimalMapping).done).toBe(
      false,
    )
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
      // The schema: no data source on 2025-09-03, then the 2022-06-28 one.
      .mockResolvedValueOnce(jsonResponse({ data_sources: [] }))
      .mockResolvedValueOnce(jsonResponse({ properties: {} }))
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
    expect(fetchImpl).toHaveBeenCalledTimes(4)
    expect(fetchImpl.mock.calls[0][0]).toMatch(/\/databases\/db1$/)
    const secondBody = JSON.parse(
      (fetchImpl.mock.calls[3][1] as RequestInit).body as string,
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

describe('Notion sub-items (APP-304)', () => {
  const page = (extra: Record<string, unknown>) => ({
    id: 'child',
    properties: {
      Name: { type: 'title', title: [{ plain_text: 'Sweep' }] },
      Done: { type: 'checkbox', checkbox: false },
      ...extra,
    },
  })

  test('reads the parent from the sub-items relation Notion adds', () => {
    const task = mapNotionPage(
      page({
        'Parent item': { type: 'relation', relation: [{ id: 'attic' }] },
        'Sub-item': { type: 'relation', relation: [] },
      }),
      minimalMapping,
    )
    expect(task.parentExternalId).toBe('attic')
  })

  test('a top-level page, or another relation, has no parent', () => {
    expect(
      mapNotionPage(
        page({ 'Parent item': { type: 'relation', relation: [] } }),
        minimalMapping,
      ).parentExternalId,
    ).toBeUndefined()
    expect(
      mapNotionPage(
        page({ Project: { type: 'relation', relation: [{ id: 'p' }] } }),
        minimalMapping,
      ).parentExternalId,
    ).toBeUndefined()
  })
})

describe('Notion sub-items by where the relation points (APP-451)', () => {
  const DB = '11111111-2222-3333-4444-555555555555'
  const DS = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  const OTHER = '99999999-8888-7777-6666-555555555555'
  const relationTo = (
    databaseId: string,
    extra: Record<string, unknown> = {},
  ) => ({
    type: 'relation',
    relation: { database_id: databaseId, type: 'dual_property', ...extra },
  })
  const page = (id: string, relations: Record<string, string[]> = {}) => ({
    id,
    properties: {
      Name: { type: 'title', title: [{ plain_text: id }] },
      Done: { type: 'checkbox', checkbox: false },
      ...Object.fromEntries(
        Object.entries(relations).map(([name, ids]) => [
          name,
          { type: 'relation', relation: ids.map((rid) => ({ id: rid })) },
        ]),
      ),
    },
  })

  type Schema = Record<string, unknown>
  /**
   * Notion as `fetchTasks` sees it: the data-source schema on 2025-09-03
   * (`dataSource`, with limits), the legacy schema on 2022-06-28 (`legacy`),
   * and the pages. A schema left out answers 500.
   */
  async function fetchWith(
    { dataSource, legacy }: { dataSource?: Schema; legacy?: Schema },
    pages: ReturnType<typeof page>[],
  ) {
    const calls: string[] = []
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      const version = (init.headers as Record<string, string>)['Notion-Version']
      const path = url.replace('https://api.notion.com/v1', '')
      calls.push(`${init.method} ${path} ${version}`)
      if (path === `/databases/${DB}/query`) {
        expect(version).toBe('2022-06-28')
        return jsonResponse({ results: pages, has_more: false, next_cursor: null })
      }
      if (path === `/databases/${DB}` && version === '2025-09-03') {
        return dataSource
          ? jsonResponse({ object: 'database', data_sources: [{ id: DS, name: 'Taken' }] })
          : jsonResponse({}, 500)
      }
      if (path === `/data_sources/${DS}` && dataSource) {
        return jsonResponse({ properties: { Name: { type: 'title' }, ...dataSource } })
      }
      if (path === `/databases/${DB}` && version === '2022-06-28' && legacy) {
        return jsonResponse({ properties: { Name: { type: 'title' }, ...legacy } })
      }
      return jsonResponse({}, 500)
    })
    const tasks = await notionAdapter.fetchTasks(
      'tok',
      { sourceId: DB, propertyMapping: minimalMapping },
      fetchImpl as unknown as typeof fetch,
    )
    return {
      parents: Object.fromEntries(tasks.map((t) => [t.externalId, t.parentExternalId])),
      calls,
    }
  }

  const dependencies = {
    'Blocked by': relationTo(DB, { limit: null }),
    Blocking: relationTo(DB, { limit: null }),
  }

  test('task dependencies only: nothing nests, not even under a task blocking two', async () => {
    const { parents } = await fetchWith({ dataSource: dependencies }, [
      page('verf', { Blocking: ['schuren', 'plakken'], 'Blocked by': [] }),
      page('schuren', { 'Blocked by': ['verf'], Blocking: [] }),
      page('plakken', { 'Blocked by': ['verf'], Blocking: [] }),
    ])
    expect(parents).toEqual({ verf: undefined, schuren: undefined, plakken: undefined })
  })

  test('dependencies and English sub-items: the parent is "Parent item"', async () => {
    const { parents, calls } = await fetchWith(
      {
        dataSource: {
          ...dependencies,
          'Parent item': relationTo(DB, { limit: 1 }),
          'Sub-item': relationTo(DB, { limit: null }),
        },
      },
      [
        page('zolder', { 'Sub-item': ['dozen'], Blocking: ['dozen'] }),
        page('dozen', { 'Parent item': ['zolder'], 'Blocked by': ['zolder'] }),
      ],
    )
    expect(parents).toEqual({ zolder: undefined, dozen: 'zolder' })
    // The schema comes from the data source; the pages from the old API.
    expect(calls).toEqual([
      `GET /databases/${DB} 2025-09-03`,
      `GET /data_sources/${DS} 2025-09-03`,
      `POST /databases/${DB}/query 2022-06-28`,
    ])
  })

  test('dependencies and English sub-items without limits: the name decides', async () => {
    const { parents } = await fetchWith(
      {
        legacy: {
          ...dependencies,
          'Parent item': relationTo(DB),
          'Sub-item': relationTo(DB),
        },
      },
      [
        page('zolder', { 'Sub-item': ['dozen'] }),
        page('dozen', { 'Parent item': ['zolder'], 'Blocked by': ['zolder'] }),
      ],
    )
    expect(parents).toEqual({ zolder: undefined, dozen: 'zolder' })
  })

  test('Dutch sub-items ("Bovenliggend item") with dependencies', async () => {
    const { parents } = await fetchWith(
      {
        legacy: {
          ...dependencies,
          'Bovenliggend item': relationTo(DB),
          Subitem: relationTo(DB),
        },
      },
      [
        page('zolder', { Subitem: ['dozen', 'vegen'] }),
        page('dozen', { 'Bovenliggend item': ['zolder'] }),
        page('vegen', { 'Bovenliggend item': ['zolder'], 'Blocked by': ['dozen'] }),
      ],
    )
    expect(parents).toEqual({ zolder: undefined, dozen: 'zolder', vegen: 'zolder' })
  })

  test('a renamed parent relation with a limit of one page', async () => {
    const { parents } = await fetchWith(
      {
        dataSource: {
          'Hoort bij': relationTo(DB.replaceAll('-', ''), { limit: 1 }),
          Stappen: relationTo(DB, { limit: null }),
        },
      },
      [page('zolder', { Stappen: ['dozen'] }), page('dozen', { 'Hoort bij': ['zolder'] })],
    )
    expect(parents).toEqual({ zolder: undefined, dozen: 'zolder' })
  })

  test('a renamed pair without a limit or a known name nests nothing', async () => {
    const { parents } = await fetchWith(
      { dataSource: { Boven: relationTo(DB, { limit: null }), Onder: relationTo(DB, { limit: null }) } },
      [page('zolder', { Onder: ['dozen'] }), page('dozen', { Boven: ['zolder'] })],
    )
    expect(parents).toEqual({ zolder: undefined, dozen: undefined })
  })

  test('a lone relation back to the database is not the parent by itself', async () => {
    const { parents } = await fetchWith(
      { dataSource: { Gerelateerd: relationTo(DB, { type: 'single_property', limit: null }) } },
      [page('zolder'), page('dozen', { Gerelateerd: ['zolder'] })],
    )
    expect(parents).toEqual({ zolder: undefined, dozen: undefined })
  })

  test('a relation to another database is not the parent, even named "Parent"', async () => {
    const { parents } = await fetchWith(
      { dataSource: { Parent: relationTo(OTHER, { limit: 1 }), Project: relationTo(OTHER) } },
      [page('zolder', { Parent: ['p1'], Project: ['p2'] })],
    )
    expect(parents).toEqual({ zolder: undefined })
  })

  test('without any schema it falls back to the names, as before', async () => {
    const { parents } = await fetchWith({}, [
      page('attic'),
      page('sweep', { 'Parent item': ['attic'] }),
      page('box', { 'Blocked by': ['attic'] }),
    ])
    expect(parents).toEqual({ attic: undefined, sweep: 'attic', box: undefined })
  })

  test('deeper Notion nesting, or a parent not in the list, stays one level', async () => {
    const { parents } = await fetchWith(
      { dataSource: { 'Parent item': relationTo(DB, { limit: 1 }) } },
      [
        page('zolder'),
        page('dozen', { 'Parent item': ['zolder'] }),
        page('boeken', { 'Parent item': ['dozen'] }),
        page('wees', { 'Parent item': ['elders'] }),
      ],
    )
    expect(parents).toEqual({
      zolder: undefined,
      dozen: 'zolder',
      boeken: undefined,
      wees: undefined,
    })
  })

  test('withdrawn access while reading the schema still asks to reconnect', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 401))
    await expect(
      notionAdapter.fetchTasks(
        'tok',
        { sourceId: DB, propertyMapping: minimalMapping },
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toBeInstanceOf(ProviderAuthError)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  test('parentRelationOf ignores non-relation properties', () => {
    expect(
      parentRelationOf(
        { Parent: { type: 'rich_text' }, 'Parent item': relationTo(DB) },
        DB,
      ),
    ).toBe('Parent item')
  })
})
