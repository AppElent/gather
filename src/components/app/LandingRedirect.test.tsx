import { render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { LandingRedirect } from './LandingRedirect'

/**
 * The half of the redirect that is not a pure function: which Group the reader
 * is actually in, and what they see while that is still being asked.
 *
 * Where each old path goes is settled in `legacyPaths.test.ts`. What is left
 * here is the wiring — that the answer is not acted on early, that it replaces
 * the address rather than stacking on it, and that somebody in no Group is sent
 * somewhere they can do something about it.
 */

const location = vi.hoisted(() => ({
  pathname: '/tasks',
  hash: '',
  search: {} as Record<string, unknown>,
}))
const navigateMock = vi.hoisted(() => vi.fn())
const groups = vi.hoisted(() => ({ value: undefined as unknown }))

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => location,
  useNavigate: () => navigateMock,
}))

vi.mock('convex/react', () => ({ useQuery: () => groups.value }))

vi.mock('../../../convex/_generated/api', () => ({
  api: { groups: { myGroups: 'groups:myGroups' } },
}))

const PERSONAL = { slug: 'me-alice', isPersonal: true }
const SHARED = { slug: 'jansen-household', isPersonal: false }

beforeEach(() => {
  location.pathname = '/tasks'
  location.hash = ''
  location.search = {}
  groups.value = [SHARED, PERSONAL]
  navigateMock.mockClear()
})

test('says what it is doing while it is still finding out', () => {
  groups.value = undefined

  render(<LandingRedirect />)

  expect(screen.getByText(/taking you there/i)).toBeDefined()
  expect(navigateMock).not.toHaveBeenCalled()
})

test('lands an old address in a Group the reader is really in', () => {
  render(<LandingRedirect />)

  expect(navigateMock).toHaveBeenCalledWith({
    to: '/g/$groupSlug/tasks',
    params: { groupSlug: 'me-alice' },
    search: {},
    hash: undefined,
    replace: true,
  })
})

test('carries the record an old address named', () => {
  location.pathname = '/recipes/r1/edit'

  render(<LandingRedirect />)

  expect(navigateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      to: '/g/$groupSlug/recipes/$recipeId/edit',
      params: { groupSlug: 'me-alice', recipeId: 'r1' },
    }),
  )
})

test('keeps the fragment the reader was pointed at', () => {
  location.hash = 'today'

  render(<LandingRedirect />)

  expect(navigateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      to: '/g/$groupSlug/tasks',
      hash: 'today',
    }),
  )
})

test('lands an address with no equivalent on Home rather than erroring', () => {
  location.pathname = '/some/page/that/never/existed'

  render(<LandingRedirect />)

  expect(navigateMock).toHaveBeenCalledWith(
    expect.objectContaining({ to: '/g/$groupSlug' }),
  )
})

test('takes the Group from the reader, not from the address', () => {
  groups.value = [SHARED]

  render(<LandingRedirect />)

  expect(navigateMock).toHaveBeenCalledWith(
    expect.objectContaining({ params: { groupSlug: 'jansen-household' } }),
  )
})

test('sends someone in no Group somewhere they can join one', () => {
  groups.value = []

  render(<LandingRedirect />)

  expect(navigateMock).toHaveBeenCalledWith({ to: '/groups', replace: true })
})

/**
 * The one the mocks above nearly hid, and the preview caught.
 *
 * `useLocation` subscribes to the router rather than to this route, so once the
 * redirect starts, the pathname read here is already the destination while the
 * component is still mounted. The destination is not a legacy path, so a second
 * pass resolves nothing and falls back to Home — overwriting the page the
 * reader actually asked for. Live, every legacy path landed on Home; only the
 * ones whose equivalent is Home looked right.
 */
test('does not talk itself out of the destination it just chose', () => {
  const view = render(<LandingRedirect />)

  expect(navigateMock).toHaveBeenCalledTimes(1)

  // What the router does next: the address becomes the destination, and this
  // component renders once more before it is replaced.
  location.pathname = '/g/me-alice/tasks'
  view.rerender(<LandingRedirect />)

  expect(navigateMock).toHaveBeenCalledTimes(1)
  expect(navigateMock).toHaveBeenCalledWith(
    expect.objectContaining({ to: '/g/$groupSlug/tasks' }),
  )
})

// Going back from where you land should leave the app, not bounce off this
// page and be sent forward again.
test('replaces the address instead of stacking on it', () => {
  render(<LandingRedirect />)

  expect(navigateMock.mock.calls[0][0].replace).toBe(true)
})
