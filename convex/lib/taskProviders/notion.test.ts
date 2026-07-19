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
