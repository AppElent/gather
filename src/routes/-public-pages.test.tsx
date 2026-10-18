import { screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { renderWithI18n } from '../lib/i18n/testing'
import { NotFoundPage } from './__root'
import { AboutPage } from './about'
import { PrivacyPage } from './privacy'

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
  renderWithI18n(<AboutPage />)

  expect(screen.getByText('Gather')).toBeDefined()
  expect(
    screen.getByRole('heading', { name: /one shared group/i }),
  ).toBeDefined()
  expect(screen.queryByText(/small starter/i)).toBeNull()
  expect(screen.queryByText(/TanStack Start/i)).toBeNull()
})

test('not found page is styled and gives a recovery path', () => {
  renderWithI18n(<NotFoundPage />)

  expect(screen.getByText('Gather')).toBeDefined()
  expect(screen.getByRole('heading', { name: /page not found/i })).toBeDefined()
  expect(screen.getByRole('link', { name: /go to gather/i })).toBeDefined()
  expect(screen.getByRole('main').textContent?.trim()).not.toBe('Not Found')
})

test('the privacy statement explains deletion to somebody without the app', () => {
  const { container } = renderWithI18n(<PrivacyPage />)

  expect(
    screen.getByRole('heading', { level: 1, name: 'Privacy statement' }),
  ).toBeDefined()
  // Google Play's deletion rule links straight to this section.
  const deletion = container.querySelector('#delete-account')
  expect(deletion?.querySelector('h2')?.textContent).toBe(
    'Delete your Gather account',
  )
  expect(deletion?.textContent).toMatch(/Settings → Account → Delete account/)
  expect(deletion?.textContent).toMatch(/privacy@appelent\.nl/)
})

test('the privacy statement is translated', () => {
  renderWithI18n(<PrivacyPage />, { locale: 'nl' })

  expect(
    screen.getByRole('heading', { level: 1, name: 'Privacyverklaring' }),
  ).toBeDefined()
  expect(
    screen.getByRole('heading', { name: 'Je Gather-account verwijderen' }),
  ).toBeDefined()
})

test('every public page links the privacy statement', () => {
  renderWithI18n(<AboutPage />)

  expect(
    screen
      .getByRole('link', { name: 'Privacy statement' })
      .getAttribute('href'),
  ).toBe('/privacy')
})
