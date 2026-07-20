import { render, screen } from '@testing-library/react'
import { Bell } from 'lucide-react'
import { expect, test } from 'vitest'
import {
  AvatarStack,
  IconButton,
  Pill,
  SectionHeader,
  StatusDot,
  SurfaceCard,
} from './ShellPrimitives'

test('IconButton renders an accessible icon-only button', () => {
  render(
    <IconButton label="Open alerts">
      <Bell className="h-4 w-4" aria-hidden="true" />
    </IconButton>,
  )

  expect(screen.getByRole('button', { name: 'Open alerts' })).toBeDefined()
})

test('SurfaceCard, SectionHeader, Pill, StatusDot, and AvatarStack render shell UI content', () => {
  render(
    <SurfaceCard ariaLabel="Space status">
      <SectionHeader title="Today" action={<Pill>synced</Pill>} />
      <StatusDot label="Connected" />
      <AvatarStack members={['Alex', 'Maya', 'Sam']} />
    </SurfaceCard>,
  )

  expect(screen.getByLabelText('Space status')).toBeDefined()
  expect(screen.getByRole('heading', { name: 'Today' })).toBeDefined()
  expect(screen.getByText('synced')).toBeDefined()
  expect(screen.getByText('Connected')).toBeDefined()
  expect(screen.getByText('A')).toBeDefined()
  expect(screen.getByText('M')).toBeDefined()
  expect(screen.getByText('S')).toBeDefined()
})
