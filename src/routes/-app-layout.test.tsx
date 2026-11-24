import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { renderWithI18n } from '../lib/i18n/testing'
import { AppLayout } from './_app'

const clerk = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: true as boolean | undefined,
}))
const convexAuth = vi.hoisted(() => ({
  isLoading: false,
  isAuthenticated: true,
}))
const stalled = vi.hoisted(() => ({ value: false }))
const reloadMock = vi.hoisted(() => vi.fn())
const navigateMock = vi.hoisted(() => vi.fn())
const ensureUserMock = vi.hoisted(() => vi.fn())
const deletion = vi.hoisted(() => ({ underway: false }))

vi.mock('@clerk/react', () => ({
  useAuth: () => clerk,
  useUser: () => ({ user: { firstName: 'Eric', lastName: 'Jansen' } }),
}))

vi.mock('convex/react', () => ({
  useConvexAuth: () => convexAuth,
  useMutation: () => ensureUserMock,
}))

// Stands in for the real provider (its own tests drive it): draws the gate
// until the purge starts, then only the deletion.
vi.mock('../components/account/AccountDeleteProvider', () => ({
  AccountDeleteProvider: ({ children }: { children: React.ReactNode }) =>
    deletion.underway ? <div data-testid="account-delete-underway" /> : children,
}))

vi.mock('../../convex/_generated/api', () => ({
  api: { users: { ensureUser: 'users:ensureUser' } },
}))

vi.mock('../integrations/convex/useConvexAuthStalled', () => ({
  useConvexAuthStalled: () => stalled.value,
}))

vi.mock('../components/app/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Outlet: () => <div data-testid="outlet" />,
  useNavigate: () => navigateMock,
}))

beforeEach(() => {
  clerk.isLoaded = true
  clerk.isSignedIn = true
  convexAuth.isLoading = false
  convexAuth.isAuthenticated = true
  stalled.value = false
  reloadMock.mockClear()
  navigateMock.mockClear()
  ensureUserMock.mockClear()
  deletion.underway = false
})

test('provisions the account once Convex has authenticated the session', () => {
  renderWithI18n(<AppLayout />)

  expect(ensureUserMock).toHaveBeenCalledWith({ name: 'Eric Jansen' })
})

test('an account deletion in progress replaces the gate, so nothing re-provisions the account', () => {
  deletion.underway = true

  renderWithI18n(<AppLayout />)

  expect(screen.getByTestId('account-delete-underway')).toBeInTheDocument()
  expect(screen.queryByTestId('app-shell')).toBeNull()
  expect(ensureUserMock).not.toHaveBeenCalled()
})

test('renders the app once Convex has authenticated the session', () => {
  renderWithI18n(<AppLayout />)

  expect(screen.getByTestId('app-shell')).toBeInTheDocument()
  expect(screen.getByTestId('outlet')).toBeInTheDocument()
})

test('waits while the Convex handshake is still in flight', () => {
  convexAuth.isLoading = true
  convexAuth.isAuthenticated = false

  renderWithI18n(<AppLayout />)

  expect(screen.getByText('Loading…')).toBeInTheDocument()
  expect(screen.queryByTestId('app-shell')).toBeNull()
})

test('waits out a handshake that has not stalled yet', () => {
  // Convex reports a dead handshake as "settled, not authenticated"; until the
  // stall timer fires that is indistinguishable from a slow but healthy one.
  convexAuth.isLoading = false
  convexAuth.isAuthenticated = false

  renderWithI18n(<AppLayout />)

  expect(screen.getByText('Loading…')).toBeInTheDocument()
})

test('offers a way out instead of an endless spinner once auth stalls', () => {
  convexAuth.isLoading = false
  convexAuth.isAuthenticated = false
  stalled.value = true

  renderWithI18n(<AppLayout />)

  expect(screen.queryByText('Loading…')).toBeNull()
  expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument()
})

test('reloads the page when the user asks', () => {
  convexAuth.isLoading = false
  convexAuth.isAuthenticated = false
  stalled.value = true
  // jsdom's location.reload is not configurable, so swap the whole object.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: reloadMock },
  })

  renderWithI18n(<AppLayout />)
  fireEvent.click(screen.getByRole('button', { name: /reload/i }))

  expect(reloadMock).toHaveBeenCalledTimes(1)
})

test('sends signed-out visitors to the sign-in page', () => {
  clerk.isSignedIn = false
  convexAuth.isAuthenticated = false

  renderWithI18n(<AppLayout />)

  expect(navigateMock).toHaveBeenCalledWith({ to: '/sign-in' })
  expect(screen.queryByTestId('app-shell')).toBeNull()
})

test('waits for Clerk before deciding anything', () => {
  clerk.isLoaded = false
  clerk.isSignedIn = undefined
  convexAuth.isAuthenticated = false

  renderWithI18n(<AppLayout />)

  expect(screen.getByText('Loading…')).toBeInTheDocument()
  expect(navigateMock).not.toHaveBeenCalled()
})
