import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { AppLayout } from './_app'

const clerk = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: true as boolean | undefined,
}))
const convexAuth = vi.hoisted(() => ({
  isLoading: false,
  isAuthenticated: true,
}))
const recovery = vi.hoisted(() => ({ failed: false, retry: vi.fn() }))
const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('@clerk/clerk-react', () => ({ useAuth: () => clerk }))

vi.mock('convex/react', () => ({
  useConvexAuth: () => convexAuth,
  useMutation: () => vi.fn(),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: { users: { ensureUser: 'users:ensureUser' } },
}))

vi.mock('../integrations/convex/authRecovery', () => ({
  useConvexAuthRecovery: () => recovery,
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
  recovery.failed = false
  recovery.retry.mockClear()
  navigateMock.mockClear()
})

test('renders the app once Convex has authenticated the session', () => {
  render(<AppLayout />)

  expect(screen.getByTestId('app-shell')).toBeInTheDocument()
  expect(screen.getByTestId('outlet')).toBeInTheDocument()
})

test('waits while the Convex handshake is still in flight', () => {
  convexAuth.isLoading = true
  convexAuth.isAuthenticated = false

  render(<AppLayout />)

  expect(screen.getByText('Loading...')).toBeInTheDocument()
  expect(screen.queryByTestId('app-shell')).toBeNull()
})

test('waits while Convex auth is being recovered', () => {
  // Convex reports a failed handshake as "settled, not authenticated"; while
  // recovery is still running that is legitimately a loading state.
  convexAuth.isLoading = false
  convexAuth.isAuthenticated = false

  render(<AppLayout />)

  expect(screen.getByText('Loading...')).toBeInTheDocument()
})

test('offers a retry instead of an endless spinner when auth cannot recover', () => {
  convexAuth.isLoading = false
  convexAuth.isAuthenticated = false
  recovery.failed = true

  render(<AppLayout />)

  expect(screen.queryByText('Loading...')).toBeNull()
  expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
})

test('re-runs the handshake when the user retries', () => {
  convexAuth.isLoading = false
  convexAuth.isAuthenticated = false
  recovery.failed = true

  render(<AppLayout />)
  fireEvent.click(screen.getByRole('button', { name: /try again/i }))

  expect(recovery.retry).toHaveBeenCalledTimes(1)
})

test('sends signed-out visitors to the sign-in page', () => {
  clerk.isSignedIn = false
  convexAuth.isAuthenticated = false

  render(<AppLayout />)

  expect(navigateMock).toHaveBeenCalledWith({ to: '/sign-in' })
  expect(screen.queryByTestId('app-shell')).toBeNull()
})

test('waits for Clerk before deciding anything', () => {
  clerk.isLoaded = false
  clerk.isSignedIn = undefined
  convexAuth.isAuthenticated = false

  render(<AppLayout />)

  expect(screen.getByText('Loading...')).toBeInTheDocument()
  expect(navigateMock).not.toHaveBeenCalled()
})
