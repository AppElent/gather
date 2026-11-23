import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { renderInGroup } from '../app/testing'
import { EnergyPriceFeedPage } from './EnergyPriceFeedPage'
import { priceView } from './testing'

/** The price source (APP-493): the key is only ever sent, never shown. */

const state = vi.hoisted(() => ({
  view: undefined as unknown,
  calls: [] as unknown[],
  refuse: null as string | null,
}))

vi.mock('convex/react', () => ({
  useQuery: () => state.view,
  useMutation: () => async (args: unknown) => {
    state.calls.push(args)
    if (state.refuse) {
      throw Object.assign(new Error('refused'), { data: { kind: state.refuse } })
    }
    return null
  },
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))
vi.mock('../../../convex/_generated/api', () => ({
  api: {
    energyPrices: { view: 'energyPrices:view', saveFeed: 'energyPrices:saveFeed' },
  },
}))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-20T18:55:00Z'))
  state.view = priceView()
  state.calls = []
  state.refuse = null
})
afterEach(() => {
  vi.useRealTimers()
})

const choose = (name: RegExp) => fireEvent.click(screen.getByRole('radio', { name }))
const typeKey = (value: string) =>
  fireEvent.change(screen.getByLabelText('Key'), { target: { value } })

describe('EnergyPriceFeedPage', () => {
  test('EnergyZero needs no key and nothing to save', () => {
    renderInGroup(<EnergyPriceFeedPage />)
    expect(screen.getByRole('radio', { name: /EnergyZero/ })).toBeChecked()
    expect(screen.queryByLabelText('Key')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: /More suppliers/ })).toBeDisabled()
  })

  test('a typed key is sent once and the field is empty after', async () => {
    renderInGroup(<EnergyPriceFeedPage />)
    choose(/Tibber/)
    expect(screen.getByText(/Tibber gives your own contract price/)).toBeInTheDocument()
    expect(screen.getByLabelText('Key')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    typeKey('my-key')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByLabelText('Key')).toHaveValue(''))
    expect(state.calls).toEqual([
      { groupSlug: expect.any(String), provider: 'tibber', key: 'my-key' },
    ])
  })

  test('a typed key does not follow to another provider', () => {
    renderInGroup(<EnergyPriceFeedPage />)
    choose(/Tibber/)
    typeKey('my-key')
    choose(/ENTSO-E/)
    expect(screen.getByLabelText('Key')).toHaveValue('')
  })

  test('a saved key is never shown', () => {
    state.view = priceView({ provider: 'tibber', hasKey: true })
    renderInGroup(<EnergyPriceFeedPage />)
    const field = screen.getByLabelText('Key')
    expect(field).toHaveValue('')
    expect(field).toHaveAttribute('placeholder', 'Saved. Type a new one to replace it.')
  })

  test('a refusal and a failed fetch read in words', async () => {
    state.view = priceView({
      provider: 'tibber',
      hasKey: true,
      status: 'needsKey',
      lastError: 'keyRejected',
    })
    state.refuse = 'energy:priceKeyInvalid'
    renderInGroup(<EnergyPriceFeedPage />, { locale: 'nl' })
    expect(screen.getByRole('status')).toHaveTextContent(/Tibber weigert de sleutel/)
    fireEvent.change(screen.getByLabelText('Sleutel'), { target: { value: 'a b' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bewaar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Dat is geen sleutel/)
  })

  test('a Member who is not an admin reads, and changes nothing', () => {
    state.view = priceView({ provider: 'entsoe', hasKey: true, canManage: false })
    renderInGroup(<EnergyPriceFeedPage />)
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
    expect(screen.queryByLabelText('Key')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(screen.getByText('A key is saved.')).toBeInTheDocument()
    expect(
      screen.getByText('Only admins of the Group can change the price source.'),
    ).toBeInTheDocument()
  })
})
