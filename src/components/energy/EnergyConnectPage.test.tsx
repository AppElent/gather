import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderInGroup } from '../app/testing'
import { EnergyConnectPage } from './EnergyConnectPage'

/**
 * Connecting Home Assistant (APP-495): test, choose channels, connect. The
 * token is only ever sent, never shown.
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
  return name === 'energyHomeAssistant:test' ? state.tested : null
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
    energyHomeAssistant: {
      test: 'energyHomeAssistant:test',
      connect: 'energyHomeAssistant:connect',
    },
  },
}))

const tested = {
  version: '2026.11.2',
  hasDashboard: true,
  proposals: [
    {
      kind: 'gridImport',
      tariff: 'low',
      statisticId: 'sensor.p1_t1',
      available: true,
      existing: false,
      on: true,
      suppliedBy: null,
    },
    {
      kind: 'gas',
      statisticId: 'sensor.p1_gas',
      available: true,
      existing: false,
      on: false,
      suppliedBy: 'Meter readings',
    },
  ],
  statistics: [
    { id: 'sensor.p1_t1', name: 'P1 T1', measure: 'energy' },
    { id: 'sensor.other', name: null, measure: 'energy' },
    { id: 'sensor.p1_gas', name: null, measure: 'volume' },
  ],
}
const list = {
  siteName: 'Thuis',
  canManage: true,
  homeAssistantAddress: null as string | null,
  sources: [] as unknown[],
  channels: [],
}
const connectedList = {
  ...list,
  homeAssistantAddress: 'https://ha.example.org',
  sources: [
    {
      _id: 'ha',
      kind: 'homeAssistant',
      label: 'Home Assistant',
      status: 'ok',
      connected: true,
      channelCount: 1,
      readings: [],
    },
  ],
}

beforeEach(() => {
  state.list = list
  state.calls = []
  state.tested = tested
  state.refuse = null
  state.navigate.mockClear()
})

const callsTo = (name: string) =>
  state.calls.filter((call) => call.name === name).map((call) => call.args)

async function testConnection() {
  fireEvent.change(screen.getByLabelText('Address'), {
    target: { value: 'https://ha.example.org' },
  })
  fireEvent.change(screen.getByLabelText('Token'), {
    target: { value: 'fake-token' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Test connection' }))
  await screen.findByRole('status')
}

describe('EnergyConnectPage', () => {
  test('a test shows the version and a switch per channel, a supplied one off', async () => {
    renderInGroup(<EnergyConnectPage />)
    await testConnection()
    expect(screen.getByRole('status')).toHaveTextContent('2026.11.2')
    expect(
      screen.getAllByRole('switch').map((each) => each.getAttribute('aria-checked')),
    ).toEqual(['true', 'false', 'true'])
    expect(screen.getByLabelText('Token')).toHaveAttribute('type', 'password')
  })

  test('another sensor is picked from those that fit, and Connect sends what is on', async () => {
    renderInGroup(<EnergyConnectPage />)
    await testConnection()
    const [sensor] = screen.getAllByRole('combobox')
    expect(
      within(sensor).queryByRole('option', { name: 'sensor.p1_gas' }),
    ).not.toBeInTheDocument()
    fireEvent.change(sensor, { target: { value: 'sensor.other' } })
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))
    await waitFor(() => expect(state.navigate).toHaveBeenCalled())
    expect(callsTo('energyHomeAssistant:connect')).toMatchObject([
      {
        address: 'https://ha.example.org',
        token: 'fake-token',
        channels: [
          { kind: 'gridImport', tariff: 'low', statisticId: 'sensor.other' },
        ],
        history: true,
      },
    ])
  })

  test('a channel whose sensor is gone can be switched off, not on again', async () => {
    const [grid, gas] = tested.proposals
    state.tested = {
      ...tested,
      proposals: [grid, { ...gas, available: false, existing: true, on: true }],
    }
    renderInGroup(<EnergyConnectPage />)
    await testConnection()
    const gone = () => screen.getAllByRole('switch')[1]
    expect(gone()).toBeEnabled()
    fireEvent.click(gone())
    expect(gone()).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))
    await waitFor(() => expect(state.navigate).toHaveBeenCalled())
    expect(callsTo('energyHomeAssistant:connect')).toMatchObject([
      { channels: [{ kind: 'gridImport' }] },
    ])
  })

  test('changing the address asks for a new test', async () => {
    renderInGroup(<EnergyConnectPage />)
    await testConnection()
    fireEvent.change(screen.getByLabelText('Address'), {
      target: { value: 'https://other.example.org' },
    })
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  test('a refused token is said in words', async () => {
    state.refuse = 'energy:sourceBadToken'
    renderInGroup(<EnergyConnectPage />, { locale: 'nl' })
    fireEvent.change(screen.getByLabelText('Adres'), {
      target: { value: 'https://ha.example.org' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Verbinding testen' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/token/)
  })

  test('editing keeps the stored token and asks before disconnecting', async () => {
    state.list = connectedList
    renderInGroup(<EnergyConnectPage />)
    expect(screen.getByLabelText('Token')).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }))
    await screen.findByRole('status')
    expect(callsTo('energyHomeAssistant:test')).toEqual([
      { groupSlug: expect.any(String), address: 'https://ha.example.org' },
    ])
    fireEvent.click(
      screen.getByRole('button', { name: 'Disconnect Home Assistant' }),
    )
    expect(callsTo('energySources:disconnect')).toEqual([])
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Disconnect Home Assistant' }),
    )
    await waitFor(() =>
      expect(callsTo('energySources:disconnect')).toHaveLength(1),
    )
  })

  test('a Member who is not an admin sees no form', () => {
    state.list = { ...list, canManage: false }
    renderInGroup(<EnergyConnectPage />)
    expect(screen.queryByLabelText('Address')).not.toBeInTheDocument()
    expect(screen.getByText(/Only admins of the Group/)).toBeInTheDocument()
  })
})
