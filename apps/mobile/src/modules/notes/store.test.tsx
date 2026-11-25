// @vitest-environment jsdom
/** The notes list over pages that stop at a number of bytes (APP-805). */
import { expect, test, vi } from 'vitest'
import { mount } from '../../testing/dom'
import { useNotesList } from './store'

type Page = { results: { _id: string }[]; status: string; loadMore: () => void }
const state = vi.hoisted(() => ({ pinned: {} as unknown, rest: {} as unknown }))

vi.mock('convex/react', () => ({ useMutation: () => () => {} }))
vi.mock('../../convex/api', () => ({ api: { notes: {} } }))
vi.mock('../../convex/queries', () => ({
  useQuery: () => undefined,
  usePaginatedQuery: (_: unknown, args: { pinnedOnly?: boolean }) =>
    args.pinnedOnly ? state.pinned : state.rest,
}))
vi.mock('../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { slug: 'home' } }),
}))

function read(pinned: Partial<Page>, rest: Partial<Page>) {
  const page = { results: [], status: 'Exhausted' }
  const load = { pinned: vi.fn(), rest: vi.fn() }
  state.pinned = { ...page, loadMore: load.pinned, ...pinned }
  state.rest = { ...page, loadMore: load.rest, ...rest }
  let list = {} as ReturnType<typeof useNotesList>
  function Probe() {
    list = useNotesList()
    return null
  }
  mount(<Probe />).unmount()
  return { list, load }
}
const some = [{ _id: 'a' }]

test('pinned notes load to the end; the rest only when asked', () => {
  const { list, load } = read(
    { results: some, status: 'CanLoadMore' },
    { results: some, status: 'CanLoadMore' },
  )
  expect(load.pinned).toHaveBeenCalled()
  expect(load.rest).not.toHaveBeenCalled()
  expect(list).toMatchObject({ loading: false, hasMore: true })
})

test('a page of the rest with nothing in it goes on to the next', () => {
  const { list, load } = read({}, { status: 'CanLoadMore' })
  expect(load.rest).toHaveBeenCalled()
  expect(list.loading).toBe(true)
})

test('only two halves looked through are no notes', () => {
  expect(read({}, {}).list.loading).toBe(false)
  expect(read({ status: 'LoadingMore' }, {}).list.loading).toBe(true)
})
