// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { mount } from '../testing/dom'
import type { QueryResult } from './searchResults'

const server = vi.hoisted(() => ({
  asked: [] as Record<string, unknown>[],
  answer: (_args: Record<string, unknown>): unknown => undefined,
}))

vi.mock('../convex/api', () => ({ api: { search: { group: 'search:group' } } }))
vi.mock('../convex/queries', () => ({
  useQueries: (requests: Record<string, { args: Record<string, unknown> }>) =>
    Object.fromEntries(
      Object.entries(requests).map(([id, { args }]) => {
        server.asked.push(args)
        return [id, server.answer(args)]
      }),
    ),
}))

const { useGroupSearch } = await import('./useGroupSearch')

const args = { groupSlug: 'home', query: 'milk' }
const row = (title: string): QueryResult => ({
  id: title,
  type: 'note',
  title,
  tags: [],
  excerpt: '',
  creationTime: 1,
})
const unmounts: (() => void)[] = []

beforeEach(() => {
  server.asked = []
})
afterEach(() => {
  for (const unmount of unmounts.splice(0)) unmount()
})

function run(filters: Parameters<typeof useGroupSearch>[1]) {
  let seen: QueryResult[] | undefined
  function Probe() {
    seen = useGroupSearch(args, filters)
    return null
  }
  const view = mount(<Probe />)
  unmounts.push(() => view.unmount())
  return seen?.map((each) => each.title)
}

test('sends the filters and reads only the filtered search', () => {
  server.answer = () => [row('sam')]
  expect(run({ createdBy: 'sam' })).toEqual(['sam'])
  expect(server.asked).toEqual([{ ...args, createdBy: 'sam' }])
})

test('sends none when none is set', () => {
  server.answer = () => [row('all')]
  expect(run(null)).toEqual(['all'])
  expect(server.asked).toEqual([args])
})

test('waits for the filtered search', () => {
  server.answer = () => undefined
  expect(run({ createdBy: 'sam' })).toBeUndefined()
  expect(server.asked).toHaveLength(1)
})

test('an older server that refuses the filters answers the plain search', () => {
  server.answer = (asked) =>
    'createdBy' in asked ? new Error('ArgumentValidationError') : [row('all')]
  expect(run({ createdBy: 'sam' })).toEqual(['all'])
})

test('a plain search that fails too throws to the error boundary', () => {
  server.answer = () => new Error('down')
  expect(() => run({ createdBy: 'sam' })).toThrow('down')
})

test('waits for the plain rows after an empty filtered search', () => {
  server.answer = (asked) => ('createdBy' in asked ? [] : undefined)
  expect(run({ createdBy: 'sam' })).toBeUndefined()
  expect(server.asked).toHaveLength(2)
})

test('an empty filtered search falls back on the plain rows', () => {
  server.answer = (asked) => ('createdBy' in asked ? [] : [row('all')])
  expect(run({ createdBy: 'sam' })).toEqual(['all'])
})
