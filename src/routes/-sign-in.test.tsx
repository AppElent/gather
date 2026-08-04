import { fireEvent, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { renderWithI18n } from '../lib/i18n/testing'
import { SignInPage } from './sign-in'

const authState = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: false,
}))

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => authState,
}))

vi.mock('@appelent/auth', () => ({
  SignInForm: ({ onSuccess }: { onSuccess: () => void }) => (
    <section aria-label="Sign in form">
      <button type="button" onClick={onSuccess}>
        Sign in
      </button>
      <button type="button">▶ Dev: log in as test user</button>
    </section>
  ),
  TestLoginButton: ({ onSuccess }: { onSuccess: () => void }) => (
    <button type="button" onClick={onSuccess}>
      ▶ Dev: log in as test user
    </button>
  ),
  useAuthConfig: () => ({ paths: { afterAuth: '/' } }),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: ({
    children,
    to,
    className,
  }: {
    children: React.ReactNode
    to: string
    className?: string
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
}))

test('renders one dev login button from the sign-in form', () => {
  authState.isLoaded = true
  authState.isSignedIn = false

  renderWithI18n(<SignInPage />)

  expect(
    screen.getAllByRole('button', { name: '▶ Dev: log in as test user' }),
  ).toHaveLength(1)
})

test('redirects signed-in users away from the sign-in page', () => {
  authState.isLoaded = true
  authState.isSignedIn = true
  navigateMock.mockClear()

  renderWithI18n(<SignInPage />)

  expect(navigateMock).toHaveBeenCalledWith({ to: '/' })
})

test('keeps form success navigation to the post-auth route', () => {
  authState.isLoaded = true
  authState.isSignedIn = false
  navigateMock.mockClear()

  renderWithI18n(<SignInPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(navigateMock).toHaveBeenCalledWith({ to: '/' })
})
