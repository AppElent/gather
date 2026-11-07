import { render, screen } from '@testing-library/react'
import { Bell } from 'lucide-react'
import { expect, test } from 'vitest'
import { IconButton, Pill, SectionHeader, SurfaceCard } from './ShellPrimitives'

test('IconButton renders an accessible icon-only button', () => {
  render(
    <IconButton label="Open alerts">
      <Bell className="h-4 w-4" aria-hidden="true" />
    </IconButton>,
  )

  expect(screen.getByRole('button', { name: 'Open alerts' })).toBeDefined()
})

test('SurfaceCard, SectionHeader, and Pill render shell UI content', () => {
  render(
    <SurfaceCard ariaLabel="Group status">
      <SectionHeader title="Today" action={<Pill>synced</Pill>} />
    </SurfaceCard>,
  )

  expect(screen.getByLabelText('Group status')).toBeDefined()
  expect(screen.getByRole('heading', { name: 'Today' })).toBeDefined()
  expect(screen.getByText('synced')).toBeDefined()
})
