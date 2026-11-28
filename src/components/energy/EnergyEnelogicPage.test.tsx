import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { renderInGroup } from '../app/testing'
import { EnergyEnelogicPage } from './EnergyEnelogicPage'

/**
 * Connecting Enelogic (APP-497): sign in there, read the measuring points,
 * choose channels, connect. A refused grant asks to sign in again.
 */

const state = vi.hoisted(() => ({
  list: undefined as unknown,
  calls: [] as { name: string; args: unknown }[],
  tested: null as unknown,
  refuse: null as string | null,
  navigate: vi.fn(),
}))

const recorded = vi.hoisted(() => (name: string) => async (args: unknown) => {
  state.calls.push({ name, args })
  if (state.refuse) {
    throw Object.assign(new Error('refused'), { data: { kind: state.refuse } })
  }
  if (name === 'energyEnelogic:authorizeUrl') {
    return 'https://enelogic.com/oauth/v2/auth?client_id=x'
  }
  return name === 'energyEnelogic:test' ? state.tested : null
})

vi.mock('convex/react', () => ({
  useQuery: () => state.list,
  useMutation: recorded,
  useAction: recorded,
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => state.navigate,
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    energySources: {
      list: 'energySources:list',
      disconnect: 'energySources:disconnect',
    },
    energyEnelogic: {
      authorizeUrl: 'energyEnelogic:authorizeUrl',
      test: 'energyEnelogic:test',
      connect: 'energyEnelogic:connect',
    },
  },
}))

const tested = {
  proposals: [
    {
      kind: 'gridImport',
      tariff: 't1',
      statisticId: '11:181',
      available: true,
      on: true,
      suppliedBy: null,
    },
    {
      kind: 'gas',
      statisticId: '12:180',
      available: true,
      on: false,
      suppliedBy: 'Meter readings',
    },
  ],
  statistics: [
    { id: '11:181', name: 'Stroom · 1.8.1', measure: 'energy' },
    { id: '13:181', name: 'Oud · 1.8.1', measure: 'energy' },
    { id: '11:182', name: 'Stroom · 1.8.2', measure: 'energy' },
    { id: '12:180', name: 'Gas · 1.8.0', measure: 'volume' },
  ],
}
const list = {
  siteName: 'Thuis',
  canManage: true,
  homeAssistantAddress: null,
  sources: [] as unknown[],
  channels: [],
}
const source = {
  _id: 'en',
  kind: 'enelogic',
  label: 'Enelogic',
  status: 'ok',
  connected: true,
  channelCount: 0,
  readings: [],
}

const location = { href: 'http://localhost/energy/enelogic' }

beforeEach(() => {
  state.list = list
  state.calls = []
  state.tested = tested
  state.refuse = null
  state.navigate.mockClear()
  sessionStorage.clear()
  vi.stubGlobal('location', location)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const callsTo = (name: string) =>
  state.calls.filter((call) => call.name === name).map((call) => call.args)

describe('EnergyEnelogicPage', () => {
  test('signing in leaves for Enelogic, remembering the way back', async () => {
    renderInGroup(<EnergyEnelogicPage />)
    expect(
      screen.queryByRole('button', { name: 'Read measuring points' }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sign in at Enelogic' }))
    await waitFor(() =>
      expect(location.href).toBe(
        'https://enelogic.com/oauth/v2/auth?client_id=x',
      ),
    )
    const [args] = callsTo('energyEnelogic:authorizeUrl') as {
      state: string
      redirectUri: string
    }[]
    expect(args?.state).toMatch(/^enelogic\./)
    expect(args?.redirectUri).toMatch(/\/integrations\/callback$/)
    expect(sessionStorage.getItem('gather.oauth.returnTo')).toBe(
      '/energy/enelogic',
    )
  })

  test('once signed in, reads the points and connects what is on', async () => {
    state.list = { ...list, sources: [source] }
    renderInGroup(<EnergyEnelogicPage />)
    expect(screen.getByText(/Gather may read your Enelogic/)).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Read measuring points' }),
    )
    expect(await screen.findByRole('status')).toHaveTextContent('2 channels')
    expect(
      screen
        .getAllByRole('switch')
        .map((each) => each.getAttribute('aria-checked')),
    ).toEqual(['true', 'false', 'true'])
    // Only registers that read this channel's kind and tariff.
    const [register] = screen.getAllByRole('combobox')
    expect(
      within(register).getAllByRole('option').map((each) => each.textContent),
    ).toEqual(['Stroom · 1.8.1', 'Oud · 1.8.1'])
    fireEvent.change(register, { target: { value: '13:181' } })
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))
    await waitFor(() => expect(state.navigate).toHaveBeenCalled())
    expect(callsTo('energyEnelogic:connect')).toMatchObject([
      {
        channels: [{ kind: 'gridImport', tariff: 't1', statisticId: '13:181' }],
        history: true,
      },
    ])
  })

  test('a refused grant says so and offers to sign in again', () => {
    state.list = {
      ...list,
      sources: [
        {
          ...source,
          status: 'needsReconnect',
          lastError: 'enelogicRevoked',
          lastSyncedAt: Date.now() - 3_600_000,
        },
      ],
    }
    renderInGroup(<EnergyEnelogicPage />)
    expect(
      screen.getByText(/Enelogic no longer gives Gather access/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Sign in at Enelogic again' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Read measuring points' }),
    ).not.toBeInTheDocument()
  })

  test('disconnecting asks first', async () => {
    state.list = { ...list, sources: [{ ...source, channelCount: 2 }] }
    renderInGroup(<EnergyEnelogicPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Enelogic' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Disconnect Enelogic' }),
    )
    await waitFor(() =>
      expect(callsTo('energySources:disconnect')).toEqual([
        { groupSlug: expect.any(String), kind: 'enelogic' },
      ]),
    )
  })

  test('a Member who is not an admin cannot sign in', () => {
    state.list = { ...list, canManage: false }
    renderInGroup(<EnergyEnelogicPage />)
    expect(
      screen.queryByRole('button', { name: 'Sign in at Enelogic' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/Only admins of the Group/)).toBeInTheDocument()
  })
})
