import { screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { renderInGroup } from '../app/testing'
import { EnergySourcesPage } from './EnergySourcesPage'

/** Sources (APP-495): each with its state in words; connecting is for admins. */

const state = vi.hoisted(() => ({ list: undefined as unknown }))

vi.mock('convex/react', () => ({ useQuery: () => state.list }))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: { energySources: { list: 'energySources:list' } },
}))

const source = {
  _id: 'ha',
  kind: 'homeAssistant',
  label: 'Home Assistant',
  status: 'ok',
  connected: true,
  lastSyncedAt: Date.parse('2026-11-20T09:15:00Z'),
  channelCount: 1,
  readings: [],
}
const list = {
  siteName: 'Thuis',
  canManage: true,
  homeAssistantAddress: null,
  sources: [source],
  channels: [{ _id: 'c1', sourceId: 'ha', kind: 'gas' }],
}
const hrefs = () =>
  screen.getAllByRole('link').map((link) => link.getAttribute('href'))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-20T12:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('EnergySourcesPage', () => {
  test('a connected source says when it was read and opens its connection', () => {
    state.list = list
    renderInGroup(<EnergySourcesPage />, { locale: 'nl' })
    expect(screen.getByText(/Verbonden.*10:15.*1 kanaal/)).toBeInTheDocument()
    // Once: the source itself, not an offer to add a second one.
    expect(hrefs().filter((href) => href === '/energy/connect')).toHaveLength(1)
  })

  test.each([
    ['error', 'unreachable', /antwoordt niet.*10:15/],
    ['needsReconnect', 'badToken', /weigert het token.*10:15/],
    ['error', 'statisticMissing|sensor.gone', /sensor\.gone.*10:15/],
  ] as const)('%s %s reads in words with the last time', (status, lastError, words) => {
    state.list = { ...list, sources: [{ ...source, status, lastError }] }
    renderInGroup(<EnergySourcesPage />, { locale: 'nl' })
    expect(screen.getByText(words)).toBeInTheDocument()
    expect(screen.getByText('Gas')).toBeInTheDocument()
  })

  test('a Member who is not an admin cannot connect or edit', () => {
    state.list = { ...list, canManage: false, sources: [], channels: [] }
    renderInGroup(<EnergySourcesPage />, { locale: 'nl' })
    expect(hrefs()).not.toContain('/energy/connect')
    expect(screen.getByText(/Alleen beheerders/)).toBeInTheDocument()
  })
})
