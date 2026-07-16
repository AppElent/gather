import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
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

test('renders public pages in the command-center visual system', () => {
  render(
    <PublicPageFrame eyebrow="Public" title="Welcome back" subtitle="Sign in.">
      <form aria-label="Auth form" />
    </PublicPageFrame>,
  )

  expect(screen.getByText('Gather')).toBeDefined()
  expect(screen.getByText('Command center')).toBeDefined()
  expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeDefined()
  expect(screen.getByLabelText('Auth form')).toBeDefined()
  expect(screen.getByRole('main').className).toContain('app-shell')
  expect(screen.getByRole('main').className).not.toContain('island-shell')
})
