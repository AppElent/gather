import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { CommandFeed } from './CommandFeed'
import { GroupInspector } from './GroupInspector'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  )
  return {
    ...actual,
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

test('CommandFeed renders command center activity without promising real automation', () => {
  render(<CommandFeed />)

  expect(
    screen.getByRole('heading', { name: 'Group command center' }),
  ).toBeDefined()
  expect(screen.getByText(/designed preview/i)).toBeDefined()
  expect(screen.queryByText(/automatically completed/i)).toBeNull()
  expect(screen.getByRole('heading', { name: 'Activity' })).toBeDefined()
  expect(screen.getByRole('heading', { name: 'Upcoming' })).toBeDefined()
  expect(
    screen.getByRole('heading', { name: 'Suggested actions' }),
  ).toBeDefined()
})

test('CommandFeed renders module-derived cards', () => {
  render(<CommandFeed />)

  expect(screen.getByRole('heading', { name: 'Modules' })).toBeDefined()
  expect(screen.getByText('Recipes')).toBeDefined()
  expect(screen.getByText('Meal planner')).toBeDefined()
  expect(
    screen.getByRole('heading', { name: 'Modules' }).closest('section')
      ?.className,
  ).toContain('scroll-mt-20')
})

test('GroupInspector renders group overview cards', () => {
  render(<GroupInspector />)

  expect(screen.getByText('Active modules')).toBeDefined()
  expect(screen.getByText('Today')).toBeDefined()
  expect(screen.getByText('Members')).toBeDefined()
  expect(screen.getByText('Preview data')).toBeDefined()
  expect(screen.queryByText('Alex')).toBeNull()
  expect(screen.queryByText('Maya')).toBeNull()
})
