import { screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { PublicPageFrame } from './PublicPageFrame'

vi.mock('@tanstack/react-router', () => ({
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
}))

test('renders public pages in the app visual system', () => {
  renderWithI18n(
    <PublicPageFrame eyebrow="Public" title="Welcome back" subtitle="Sign in.">
      <form aria-label="Auth form" />
    </PublicPageFrame>,
  )

  expect(screen.getByText('Gather')).toBeDefined()
  expect(screen.getByText('Household plans, shared')).toBeDefined()
  expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeDefined()
  expect(screen.getByLabelText('Auth form')).toBeDefined()
  expect(screen.getByRole('main').className).toContain('app-shell')
  expect(screen.getByRole('main').className).not.toContain('island-shell')
})
