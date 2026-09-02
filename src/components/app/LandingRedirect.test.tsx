import { render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { LandingRedirect } from './LandingRedirect'

const navigate = vi.hoisted(() => vi.fn())
const currentGroup = vi.hoisted(() => ({
  value: { current: null, groups: undefined } as {
    current: { _id: string } | null
    groups: unknown[] | undefined
  },
}))

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))
vi.mock('./useCurrentGroup', () => ({
  useCurrentGroup: () => currentGroup.value,
}))

beforeEach(() => {
  navigate.mockClear()
  currentGroup.value = { current: null, groups: undefined }
})

test('waits for the membership list', () => {
  render(<LandingRedirect />)
  expect(screen.getByText(/taking you there/i)).toBeDefined()
  expect(navigate).not.toHaveBeenCalled()
})

test('opens ambient Home when a Current Group exists', () => {
  currentGroup.value = { current: { _id: 'g1' }, groups: [{}] }
  render(<LandingRedirect />)
  expect(navigate).toHaveBeenCalledWith({ to: '/home', replace: true })
})

test('opens onboarding when there are no memberships', () => {
  currentGroup.value = { current: null, groups: [] }
  render(<LandingRedirect />)
  expect(navigate).toHaveBeenCalledWith({ to: '/groups', replace: true })
})
