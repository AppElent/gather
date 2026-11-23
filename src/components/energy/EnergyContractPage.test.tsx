import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderInGroup } from '../app/testing'
import { EnergyContractPage } from './EnergyContractPage'

/**
 * The contract (APP-494): amounts typed as on the contract, money saved in
 * cents, the latest edited in place and new tariffs a new contract.
 */

const state = vi.hoisted(() => ({
  contracts: [] as unknown,
  calls: [] as unknown[],
}))

vi.mock('convex/react', () => ({
  useQuery: () => state.contracts,
  useMutation: () => (args: unknown) => {
    state.calls.push(args)
    return Promise.resolve('k-new')
  },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    energyContracts: {
      list: 'energyContracts:list',
      save: 'energyContracts:save',
    },
  },
}))

const LATEST = {
  _id: 'k2',
  terms: {
    validFrom: '2026-01-01',
    kind: 'dynamic',
    supplierName: 'Zonneplan',
    importMarkupEurPerKwh: 0.02,
    exportFeeEurPerKwh: -0.01,
    energyTaxEurPerKwh: 0.1088,
    gasMarkupEurPerM3: 0.05,
    gasTaxEurPerM3: 0.57,
    vatPercent: 21,
    monthlyFixedCents: 750,
    yearlyTaxCreditCents: 63519,
    netMetering: true,
  },
}

const EARLIER = {
  _id: 'k1',
  terms: { ...LATEST.terms, validFrom: '2025-01-01', supplierName: 'Eneco' },
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

beforeEach(() => {
  state.contracts = []
  state.calls = []
})

describe('EnergyContractPage', () => {
  test('a first contract is saved with money in cents', async () => {
    renderInGroup(<EnergyContractPage />, { locale: 'nl' })
    type('Leverancier', 'Zonneplan')
    type('Geldig vanaf', '2026-01-01')
    fireEvent.change(screen.getAllByLabelText('Inkoopvergoeding')[0] as HTMLElement, {
      target: { value: '0,02' },
    })
    type('Terugleververgoeding', '-0,01')
    fireEvent.change(screen.getAllByLabelText('Energiebelasting')[0] as HTMLElement, {
      target: { value: '0,1088' },
    })
    type('Vaste kosten en netbeheer', '7,50')
    type('Vermindering energiebelasting', '635,19')
    expect(screen.getByRole('switch', { name: 'Salderen' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Bewaar' }))

    await waitFor(() => expect(state.calls).toHaveLength(1))
    expect(state.calls[0]).toEqual({
      groupSlug: 'jansen-household',
      contractId: undefined,
      terms: {
        validFrom: '2026-01-01',
        kind: 'dynamic',
        supplierName: 'Zonneplan',
        importMarkupEurPerKwh: 0.02,
        exportFeeEurPerKwh: -0.01,
        energyTaxEurPerKwh: 0.1088,
        gasMarkupEurPerM3: undefined,
        gasTaxEurPerM3: undefined,
        fixedTariffs: undefined,
        vatPercent: 21,
        monthlyFixedCents: 750,
        yearlyTaxCreditCents: 63519,
        netMetering: true,
      },
    })
  })

  test('a blank amount the contract needs is caught before saving', () => {
    renderInGroup(<EnergyContractPage />)
    type('Valid from', '2026-01-01')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Check the amounts: each needs a number.',
    )
    expect(state.calls).toEqual([])
  })

  test('without a date it asks for the start', () => {
    renderInGroup(<EnergyContractPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Pick the day the contract starts.',
    )
  })

  test('the latest contract is edited in place; earlier ones are listed', async () => {
    state.contracts = [LATEST, EARLIER]
    renderInGroup(<EnergyContractPage />)
    expect(screen.getByLabelText('Supplier')).toHaveValue('Zonneplan')
    expect(screen.getByLabelText('Fixed costs and grid operator')).toHaveValue(
      '7.5',
    )
    expect(screen.getByText('Eneco, dynamic · since January 1, 2025')).toBeInTheDocument()
    expect(
      screen.getByText('January 1, 2025 to December 31, 2025'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(state.calls).toHaveLength(1))
    expect(state.calls[0]).toMatchObject({
      contractId: 'k2',
      terms: { monthlyFixedCents: 750, yearlyTaxCreditCents: 63519 },
    })
  })

  test('a new contract from a date starts from the latest with no date', async () => {
    state.contracts = [LATEST]
    renderInGroup(<EnergyContractPage />)
    fireEvent.click(
      screen.getByRole('button', { name: 'New contract from a date' }),
    )
    expect(
      screen.getByRole('heading', { name: 'New contract' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Supplier')).toHaveValue('Zonneplan')
    expect(screen.getByLabelText('Valid from')).toHaveValue('')

    type('Valid from', '2027-01-01')
    // Net metering ends on 1 January 2027: no switch, saved as off.
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(state.calls).toHaveLength(1))
    expect(state.calls[0]).toMatchObject({
      contractId: undefined,
      terms: { validFrom: '2027-01-01', netMetering: false },
    })
  })

  test('a fixed contract sends its tariffs', async () => {
    renderInGroup(<EnergyContractPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Fixed' }))
    type('Valid from', '2026-03-01')
    type('Normal (T2)', '0.30')
    type('Off-peak (T1)', '0.25')
    type('Export', '0.08')
    type('Gas tariff', '1.20')
    fireEvent.change(screen.getAllByLabelText('Energy tax')[0] as HTMLElement, {
      target: { value: '0.1088' },
    })
    type('Fixed costs and grid operator', '7')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(state.calls).toHaveLength(1))
    expect(state.calls[0]).toMatchObject({
      terms: {
        kind: 'fixed',
        fixedTariffs: { t1: 0.25, t2: 0.3, export: 0.08, gas: 1.2 },
        monthlyFixedCents: 700,
      },
    })
  })
})
