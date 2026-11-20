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
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(fetchImpl.mock.calls[0][0]).toMatch(/\/databases\/db1$/)
    const secondBody = JSON.parse(
      (fetchImpl.mock.calls[2][1] as RequestInit).body as string,
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
  const OTHER = '99999999-8888-7777-6666-555555555555'
  const relationTo = (
    databaseId: string,
    extra: Record<string, unknown> = {},
  ) => ({
    type: 'relation',
    relation: { database_id: databaseId, type: 'dual_property', ...extra },
  })
  const page = (
    id: string,
    relations: Record<string, string[]> = {},
  ) => ({
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

  /** `fetchTasks` against a database with `schema` holding `pages`. */
  async function fetchWith(
    schema: Record<string, unknown> | 'unavailable',
    pages: ReturnType<typeof page>[],
  ) {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        schema === 'unavailable'
          ? jsonResponse({}, 500)
          : jsonResponse({ properties: { Name: { type: 'title' }, ...schema } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ results: pages, has_more: false, next_cursor: null }),
      )
    const tasks = await notionAdapter.fetchTasks(
      'tok',
      { sourceId: DB, propertyMapping: minimalMapping },
      fetchImpl as unknown as typeof fetch,
    )
    return Object.fromEntries(tasks.map((t) => [t.externalId, t.parentExternalId]))
  }

  test('a localised sub-items pair: the side with several pages holds the sub-items', async () => {
    const parents = await fetchWith(
      {
        'Bovenliggend item': relationTo(DB),
        Subitem: relationTo(DB),
      },
      [
        page('zolder', { Subitem: ['dozen', 'vegen'], 'Bovenliggend item': [] }),
        page('dozen', { 'Bovenliggend item': ['zolder'], Subitem: [] }),
        page('vegen', { 'Bovenliggend item': ['zolder'], Subitem: [] }),
      ],
    )
    expect(parents).toEqual({ zolder: undefined, dozen: 'zolder', vegen: 'zolder' })
  })

  test('a renamed relation with a limit of one page is the parent', async () => {
    const parents = await fetchWith(
      {
        'Hoort bij': relationTo(DB, { limit: 1 }),
        Stappen: relationTo(DB, { limit: null }),
      },
      [
        page('zolder', { Stappen: ['dozen'], 'Hoort bij': [] }),
        page('dozen', { 'Hoort bij': ['zolder'], Stappen: [] }),
      ],
    )
    expect(parents).toEqual({ zolder: undefined, dozen: 'zolder' })
  })

  test('a single relation back to the database is the parent, dashes or not', async () => {
    const parents = await fetchWith(
      { Bovenliggend: relationTo(DB.replaceAll('-', ''), { type: 'single_property' }) },
      [page('zolder'), page('dozen', { Bovenliggend: ['zolder'] })],
    )
    expect(parents).toEqual({ zolder: undefined, dozen: 'zolder' })
  })

  test('the English names Notion gives still work', async () => {
    const parents = await fetchWith(
      { 'Parent item': relationTo(DB), 'Sub-item': relationTo(DB) },
      [
        page('attic', { 'Sub-item': ['sweep'], 'Parent item': [] }),
        page('sweep', { 'Parent item': ['attic'], 'Sub-item': [] }),
      ],
    )
    expect(parents).toEqual({ attic: undefined, sweep: 'attic' })
  })

  test('a relation to another database is not the parent, even named "Parent"', async () => {
    const parents = await fetchWith(
      { Parent: relationTo(OTHER), Project: relationTo(OTHER) },
      [page('zolder', { Parent: ['p1'], Project: ['p2'] })],
    )
    expect(parents).toEqual({ zolder: undefined })
  })

  test('a pair it cannot tell apart nests nothing, so no page hides', async () => {
    // One sub-item per parent and no limit or known name: either side could
    // be the parent.
    const parents = await fetchWith(
      { Boven: relationTo(DB), Onder: relationTo(DB) },
      [
        page('zolder', { Onder: ['dozen'], Boven: [] }),
        page('dozen', { Boven: ['zolder'], Onder: [] }),
      ],
    )
    expect(parents).toEqual({ zolder: undefined, dozen: undefined })
  })

  test('without the schema it falls back to the English names', async () => {
    const parents = await fetchWith('unavailable', [
      page('attic'),
      page('sweep', { 'Parent item': ['attic'] }),
      page('box', { Bovenliggend: ['attic'] }),
    ])
    expect(parents).toEqual({ attic: undefined, sweep: 'attic', box: undefined })
  })

  test('deeper Notion nesting, or a parent not in the list, stays one level', async () => {
    const parents = await fetchWith({ Boven: relationTo(DB, { limit: 1 }) }, [
      page('zolder'),
      page('dozen', { Boven: ['zolder'] }),
      page('boeken', { Boven: ['dozen'] }),
      page('wees', { Boven: ['elders'] }),
    ])
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
        { Parent: { type: 'rich_text' }, Boven: relationTo(DB) },
        DB,
        [],
      ),
    ).toBe('Boven')
  })
})
