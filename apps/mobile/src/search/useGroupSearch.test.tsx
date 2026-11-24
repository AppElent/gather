// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { mount } from '../testing/dom'
import type { QueryResult } from './searchResults'

const server = vi.hoisted(() => ({
  asked: [] as Record<string, unknown>[],
  reported: [] as unknown[],
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
vi.mock('../observability/report', () => ({
  reportError: (error: unknown) => server.reported.push(error),
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
  server.reported = []
})
afterEach(() => {
  for (const unmount of unmounts.splice(0)) unmount()
})

function mountSearch(
  initialArgs: Parameters<typeof useGroupSearch>[0],
  initialFilters: Parameters<typeof useGroupSearch>[1],
) {
  let seen: QueryResult[] | undefined
  function Probe({
    searchArgs,
    filters,
  }: {
    searchArgs: Parameters<typeof useGroupSearch>[0]
    filters: Parameters<typeof useGroupSearch>[1]
  }) {
    seen = useGroupSearch(searchArgs, filters)
    return null
  }
  const view = mount(
    <Probe searchArgs={initialArgs} filters={initialFilters} />,
  )
  unmounts.push(() => view.unmount())
  return {
    titles: () => seen?.map((each) => each.title),
    update: (
      nextArgs: Parameters<typeof useGroupSearch>[0],
      nextFilters: Parameters<typeof useGroupSearch>[1],
    ) => {
      view.rerender(<Probe searchArgs={nextArgs} filters={nextFilters} />)
      return seen?.map((each) => each.title)
    },
  }
}

function run(filters: Parameters<typeof useGroupSearch>[1]) {
  return mountSearch(args, filters).titles()
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

test('an older server that refuses the filters answers the plain search without reporting', () => {
  server.answer = (asked) =>
    'createdBy' in asked ? new Error('ArgumentValidationError') : [row('all')]
  expect(run({ createdBy: 'sam' })).toEqual(['all'])
  expect(server.reported).toEqual([])
})

test('a Convex ArgumentValidationError with extra-field details is not reported', () => {
  server.answer = (asked) =>
    'createdBy' in asked
      ? new Error(
          '[CONVEX Q(search:group)] [Request ID: req1] Server Error\nArgumentValidationError: Object contains extra field `createdBy` that is not in the validator.',
        )
      : [row('all')]
  expect(run({ createdBy: 'sam' })).toEqual(['all'])
  expect(server.reported).toEqual([])
})

test('an Error named ArgumentValidationError is not reported', () => {
  const refusal = new Error('Object contains extra field')
  refusal.name = 'ArgumentValidationError'
  server.answer = (asked) => ('createdBy' in asked ? refusal : [row('all')])
  expect(run({ createdBy: 'sam' })).toEqual(['all'])
  expect(server.reported).toEqual([])
})

test('a non-validation filtered search error falls back and reports once per distinct message per mount', () => {
  const tzError1 = new Error('Invalid time zone')
  server.answer = (asked) => ('when' in asked ? tzError1 : [row('all')])
  const search = mountSearch(args, {
    when: 'today',
    today: '2026-11-24',
    timeZone: 'Mars/Olympus',
  })
  expect(search.titles()).toEqual(['all'])
  expect(server.reported).toEqual([tzError1])

  // Re-rendering with the same error or a fresh Error with the same message does not report again.
  search.update(args, {
    when: 'today',
    today: '2026-11-24',
    timeZone: 'Mars/Olympus',
  })
  server.answer = (asked) =>
    'when' in asked ? new Error('Invalid time zone') : [row('all')]
  search.update(args, {
    when: 'week',
    today: '2026-11-24',
    timeZone: 'Mars/Olympus',
  })
  expect(server.reported).toEqual([tzError1])

  // A distinct error message in the same mount is reported once.
  const dateError = new Error('Invalid date')
  server.answer = (asked) => ('when' in asked ? dateError : [row('all')])
  expect(
    search.update(args, {
      when: 'today',
      today: 'not-a-date',
      timeZone: 'Europe/Amsterdam',
    }),
  ).toEqual(['all'])
  expect(server.reported).toEqual([tzError1, dateError])

  // Returning to an already-reported message in the same mount does not report again.
  server.answer = (asked) =>
    'when' in asked ? new Error('Invalid time zone') : [row('all')]
  search.update(args, {
    when: 'today',
    today: '2026-11-24',
    timeZone: 'Mars/Olympus',
  })
  expect(server.reported).toEqual([tzError1, dateError])
})

test('deduplicates repeated Convex server errors that differ only by request id', () => {
  const first = new Error(
    '[CONVEX Q(search:group)] [Request ID: req-1] Server Error\nUncaught ConvexError: Invalid time zone',
  )
  const second = new Error(
    '[CONVEX Q(search:group)] [Request ID: req-2] Server Error\nUncaught ConvexError: Invalid time zone',
  )
  server.answer = (asked) => ('when' in asked ? first : [row('all')])
  const search = mountSearch(args, {
    when: 'today',
    today: '2026-11-24',
    timeZone: 'Mars/Olympus',
  })
  expect(server.reported).toEqual([first])

  server.answer = (asked) => ('when' in asked ? second : [row('all')])
  search.update(
    { groupSlug: 'home', query: 'oat milk' },
    { when: 'today', today: '2026-11-24', timeZone: 'Mars/Olympus' },
  )
  expect(server.reported).toEqual([first])
})

test('reports again on a fresh mount', () => {
  const first = new Error('Server filter bug')
  server.answer = (asked) => ('status' in asked ? first : [row('all')])
  expect(run({ status: 'open' })).toEqual(['all'])
  expect(server.reported).toEqual([first])

  const second = new Error('Server filter bug')
  server.answer = (asked) => ('status' in asked ? second : [row('all')])
  expect(run({ status: 'open' })).toEqual(['all'])
  expect(server.reported).toEqual([first, second])
})

test('a plain search that fails too throws to the error boundary without double-reporting', () => {
  server.answer = () => new Error('down')
  expect(() => run({ createdBy: 'sam' })).toThrow('down')
  expect(server.reported).toEqual([])
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

test('switching filters returns the plain rows while the new filtered search loads', () => {
  server.answer = (asked) => {
    if (asked.createdBy === 'sam') return [row('sam')]
    if (asked.createdBy === 'eve') return undefined
    return [row('sam'), row('eve')]
  }
  const search = mountSearch(args, null)
  expect(search.titles()).toEqual(['sam', 'eve'])

  expect(search.update(args, { createdBy: 'sam' })).toEqual(['sam'])

  server.asked = []
  expect(search.update(args, { createdBy: 'eve' })).toEqual(['sam', 'eve'])
  expect(server.asked).toEqual([{ ...args, createdBy: 'eve' }])

  server.answer = (asked) =>
    asked.createdBy === 'eve' ? [row('eve'), row('eve-extra')] : undefined
  expect(search.update(args, { createdBy: 'eve' })).toEqual([
    'eve',
    'eve-extra',
  ])
})

test('switching filters without plain rows keeps the previous rows while loading', () => {
  server.answer = (asked) =>
    asked.createdBy === 'sam' ? [row('sam')] : undefined
  const search = mountSearch(args, { createdBy: 'sam' })
  expect(search.titles()).toEqual(['sam'])

  server.asked = []
  expect(search.update(args, { createdBy: 'eve' })).toEqual(['sam'])
  expect(server.asked).toEqual([{ ...args, createdBy: 'eve' }])
  expect(search.update(args, { status: 'open' })).toEqual(['sam'])
})

test('offline filter changes keep showing the already loaded rows instead of waiting forever', () => {
  server.answer = () => [row('sam'), row('eve')]
  const search = mountSearch(args, null)
  expect(search.titles()).toEqual(['sam', 'eve'])

  // Offline: no query answers.
  server.answer = () => undefined
  expect(search.update(args, { createdBy: 'sam' })).toEqual(['sam', 'eve'])
  expect(search.update(args, { createdBy: 'eve' })).toEqual(['sam', 'eve'])
  expect(
    search.update(args, {
      when: 'today',
      today: '2026-11-24',
      timeZone: 'Europe/Amsterdam',
    }),
  ).toEqual(['sam', 'eve'])
  expect(search.update(args, { status: 'open' })).toEqual(['sam', 'eve'])
  expect(search.update(args, null)).toEqual(['sam', 'eve'])
})

test('does not leak held rows when the search query changes or clears', () => {
  server.answer = () => [row('sam'), row('eve')]
  const search = mountSearch(args, null)
  expect(search.titles()).toEqual(['sam', 'eve'])

  server.answer = () => undefined
  expect(
    search.update({ groupSlug: 'home', query: 'bread' }, { createdBy: 'eve' }),
  ).toBeUndefined()

  server.answer = () => [row('bread')]
  expect(
    search.update({ groupSlug: 'home', query: 'bread' }, null),
  ).toEqual(['bread'])

  server.answer = () => undefined
  expect(search.update(null, null)).toBeUndefined()
  expect(
    search.update({ groupSlug: 'home', query: 'bread' }, null),
  ).toBeUndefined()
})

test('an empty filtered search uses previously loaded plain rows while fresh plain rows load', () => {
  server.answer = () => [row('sam'), row('eve')]
  const search = mountSearch(args, null)
  expect(search.titles()).toEqual(['sam', 'eve'])

  server.answer = (asked) => ('createdBy' in asked ? [] : undefined)
  expect(search.update(args, { createdBy: 'bob' })).toEqual(['sam', 'eve'])

  server.answer = () => []
  expect(search.update(args, { createdBy: 'bob' })).toEqual([])
})
