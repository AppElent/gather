import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { NotFoundPage } from './__root'
import { AboutPage } from './about'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  )
  return {
    ...actual,
    createFileRoute: () => (options: unknown) => ({ options }),
    createRootRouteWithContext: () => () => (options: unknown) => ({
      options,
    }),
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
  }
})

vi.mock('@appelent/auth', () => ({
  AuthConfigProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  THEME_INIT_SCRIPT: '',
  ThemeSync: () => null,
}))

vi.mock('@tanstack/react-devtools', () => ({
  TanStackDevtools: () => null,
}))

vi.mock('@tanstack/react-router-devtools', () => ({
  TanStackRouterDevtoolsPanel: () => null,
}))

vi.mock('../integrations/clerk/provider', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../integrations/convex/provider', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../integrations/tanstack-query/devtools', () => ({
  default: {},
}))

test('about page uses Gather-specific copy in the public frame', () => {
  render(<AboutPage />)

  expect(screen.getByText('Gather')).toBeDefined()
  expect(
    screen.getByRole('heading', { name: /group command center/i }),
  ).toBeDefined()
  expect(screen.queryByText(/small starter/i)).toBeNull()
  expect(screen.queryByText(/TanStack Start/i)).toBeNull()
})

test('not found page is styled and gives a recovery path', () => {
  render(<NotFoundPage />)

  expect(screen.getByText('Gather')).toBeDefined()
  expect(screen.getByRole('heading', { name: /page not found/i })).toBeDefined()
  expect(screen.getByRole('link', { name: /go to dashboard/i })).toBeDefined()
  expect(screen.getByRole('main').textContent?.trim()).not.toBe('Not Found')
})
