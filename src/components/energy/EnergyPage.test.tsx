import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderInGroup } from '../app/testing'
import { EnergyPage } from './EnergyPage'

/**
 * The empty Energy Module offers one step, adding an address, and the form
 * sends what the person chose (APP-492). With an address, the page names it.
 */

const state = vi.hoisted(() => ({
  overview: undefined as unknown,
  houses: [] as unknown[],
  calls: [] as unknown[],
  result: Promise.resolve('site1') as Promise<unknown>,
}))

vi.mock('convex/react', () => ({
  useQuery: (name: string) =>
    name === 'energy:overview' ? state.overview : state.houses,
  useMutation: () => (args: unknown) => {
    state.calls.push(args)
    return state.result
  },
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    energy: { overview: 'energy:overview', createSite: 'energy:createSite' },
    houses: { list: 'houses:list' },
  },
}))

beforeEach(() => {
  state.overview = null
  state.houses = []
  state.calls = []
  state.result = Promise.resolve('site1')
})

describe('EnergyPage', () => {
  test('empty, it says what the Module does and offers to add an address', () => {
    renderInGroup(<EnergyPage />)
    expect(screen.getByText('No address yet')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'What does your power cost, every hour?' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Add your first address' }),
    ).toBeInTheDocument()
  })

  test('the form saves meter readings as the source, with the chosen House', async () => {
    state.houses = [{ _id: 'house1', name: 'Dorpsstraat 1' }]
    renderInGroup(<EnergyPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Add your first address' }))

    expect(screen.getByLabelText('Name')).toHaveValue('Home')
    fireEvent.change(screen.getByLabelText('House'), {
      target: { value: 'house1' },
    })
    fireEvent.click(screen.getByRole('radio', { name: /Type meter readings/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(state.calls).toHaveLength(1))
    expect(state.calls[0]).toEqual({
      groupSlug: expect.any(String),
      name: 'Home',
      houseId: 'house1',
      source: { kind: 'manual', label: 'Meter readings' },
    })
  })

  test('Home Assistant is the default and saves the address alone', async () => {
    renderInGroup(<EnergyPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Add your first address' }))
    expect(
      screen.getByRole('radio', { name: /Connect Home Assistant/ }),
    ).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(state.calls).toHaveLength(1))
    expect(state.calls[0]).toMatchObject({
      houseId: undefined,
      source: { kind: 'homeAssistant' },
    })
  })

  test('an empty name is caught before anything is sent', () => {
    renderInGroup(<EnergyPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Add your first address' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Give the address a name.')
    expect(state.calls).toEqual([])
  })

  test('a refusal reads in words', async () => {
    state.result = Promise.reject(
      Object.assign(new Error('refused'), { data: { kind: 'energy:houseNotFound' } }),
    )
    state.result.catch(() => {})
    renderInGroup(<EnergyPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Add your first address' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That house is not in this Group any more.',
    )
  })

  test('with an address, it names it and its source', () => {
    state.overview = {
      site: { _id: 's1', name: 'Thuis' },
      sources: [{ _id: 'src1', kind: 'manual', label: 'Meterstanden', status: 'ok' }],
    }
    renderInGroup(<EnergyPage />, { locale: 'nl' })
    expect(screen.getByRole('heading', { name: 'Thuis' })).toBeInTheDocument()
    expect(screen.getByText('Meterstanden')).toBeInTheDocument()
    expect(screen.getByText('Binnenkort')).toBeInTheDocument()
  })
})
