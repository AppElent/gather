import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { renderInGroup } from '../app/testing'
import { EnergyReadingsPage } from './EnergyReadingsPage'

/**
 * Typing meter readings (APP-494): a lower reading is refused inline before
 * anything is sent, and a site without typed meters first names them. A
 * typed reading is deleted only after the dialog asks (APP-714).
 */

const state = vi.hoisted(() => ({
  form: null as unknown,
  recent: [] as unknown,
  calls: [] as { name: string; args: unknown }[],
  result: Promise.resolve(null) as Promise<unknown>,
}))

vi.mock('convex/react', () => ({
  useQuery: (name: string) =>
    name === 'energyReadings:recent' ? state.recent : state.form,
  useMutation: (name: string) => (args: unknown) => {
    state.calls.push({ name, args })
    return state.result
  },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    energyReadings: {
      form: 'energyReadings:form',
      save: 'energyReadings:save',
      setupChannels: 'energyReadings:setupChannels',
      recent: 'energyReadings:recent',
      remove: 'energyReadings:remove',
    },
  },
}))

const PREVIOUS_AT = Date.parse('2026-11-01T11:00:00Z')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-20T18:55:00Z'))
  state.calls = []
  state.recent = []
  state.result = Promise.resolve(null)
  state.form = {
    hasManualSource: true,
    lastReadingAt: PREVIOUS_AT,
    measured: [],
    channels: [
      {
        _id: 'c1',
        kind: 'gridImport',
        tariff: 't1',
        unit: 'kWh',
        previous: { value: 24219.8, at: PREVIOUS_AT },
        onDay: null,
        next: null,
      },
      {
        _id: 'c2',
        kind: 'gas',
        unit: 'm3',
        previous: null,
        onDay: { value: 812.5, at: Date.parse('2026-11-20T08:00:00Z') },
        next: null,
      },
    ],
  }
})

afterEach(() => {
  vi.useRealTimers()
})

describe('EnergyReadingsPage', () => {
  test('a trail leads back to Energy and each meter shows its last reading', () => {
    renderInGroup(<EnergyReadingsPage />)
    expect(screen.getAllByRole('link', { name: /Energy/ })[0]).toHaveAttribute(
      'href',
      '/energy',
    )
    expect(screen.getByLabelText('Date')).toHaveValue('2026-11-20')
    expect(screen.getByLabelText('Date')).toHaveAttribute('max', '2026-11-20')
    expect(screen.getByLabelText('From the grid, off-peak')).toBeInTheDocument()
    expect(
      screen.getByText('Previous: 24,219.8 kWh on November 1, 2026'),
    ).toBeInTheDocument()
    expect(screen.getByText('No reading yet')).toBeInTheDocument()
    expect(
      screen.getByText('Replaces 812.5 m³ typed for this day'),
    ).toBeInTheDocument()
  })

  test('a lower reading is refused inline and nothing is saved', () => {
    renderInGroup(<EnergyReadingsPage />, { locale: 'nl' })
    const input = screen.getByLabelText('Stroom van het net, dal')
    fireEvent.change(input, { target: { value: '24100' } })
    fireEvent.blur(input)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Lager dan de vorige stand (24.219,8).')
    expect(input).toHaveAttribute('aria-invalid', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Bewaar' }))
    expect(state.calls).toEqual([])
  })

  test('nothing typed says so', () => {
    renderInGroup(<EnergyReadingsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Type at least one reading.',
    )
    expect(state.calls).toEqual([])
  })

  test('typed readings are saved, blanks skipped, and the fields cleared', async () => {
    renderInGroup(<EnergyReadingsPage />, { locale: 'nl' })
    const input = screen.getByLabelText('Stroom van het net, dal')
    fireEvent.change(input, { target: { value: '24.250,4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bewaar' }))

    await waitFor(() => expect(state.calls).toHaveLength(1))
    expect(state.calls[0]).toEqual({
      name: 'energyReadings:save',
      args: {
        groupSlug: 'jansen-household',
        day: '2026-11-20',
        readings: [{ channelId: 'c1', value: 24250.4 }],
      },
    })
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Standen bewaard.',
    )
    expect(input).toHaveValue('')
  })

  test('a refusal from the server reads in words', async () => {
    state.result = Promise.reject(
      Object.assign(new Error('refused'), {
        data: { kind: 'energy:readingHigher' },
      }),
    )
    state.result.catch(() => {})
    renderInGroup(<EnergyReadingsPage />)
    fireEvent.change(screen.getByLabelText('From the grid, off-peak'), {
      target: { value: '24300' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A reading is higher than a later one.',
    )
  })

  test('without typed meters, it asks which meters the Group reads', async () => {
    state.form = { hasManualSource: false, lastReadingAt: null, measured: [], channels: [] }
    renderInGroup(<EnergyReadingsPage />)
    expect(
      screen.getByRole('heading', { name: 'Which meters do you read?' }),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Date')).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('checkbox', { name: /Off-peak and normal apart/ }),
    )
    fireEvent.click(screen.getByRole('checkbox', { name: /^Gas/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add these meters' }))

    await waitFor(() => expect(state.calls).toHaveLength(1))
    expect(state.calls[0]).toEqual({
      name: 'energyReadings:setupChannels',
      args: {
        groupSlug: 'jansen-household',
        split: true,
        export: false,
        gas: true,
        sourceLabel: 'Meter readings',
      },
    })
  })

  test('a connected source that measures the meters leaves nothing to set up', () => {
    state.form = {
      hasManualSource: true,
      lastReadingAt: null,
      measured: ['gridImport', 'gridExport', 'gas'],
      channels: [],
    }
    renderInGroup(<EnergyReadingsPage />)
    expect(screen.getByText('Nothing to type here')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add these meters' })).toBeNull()
  })

  test('only a meter the connected source does not measure can be added', async () => {
    state.form = {
      hasManualSource: true,
      lastReadingAt: null,
      measured: ['gridImport', 'gridExport'],
      channels: [],
    }
    renderInGroup(<EnergyReadingsPage />)
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    const submit = screen.getByRole('button', { name: 'Add these meters' })
    expect(submit).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(submit)
    await waitFor(() => expect(state.calls).toHaveLength(1))
    expect(state.calls[0]?.args).toMatchObject({ export: false, gas: true })
  })

  describe('deleting a typed reading', () => {
    const READING_AT = Date.parse('2026-11-10T11:00:00Z')
    beforeEach(() => {
      state.recent = [
        {
          _id: 'r1',
          kind: 'gridImport',
          tariff: 't1',
          unit: 'kWh',
          value: 24250.4,
          at: READING_AT,
        },
      ]
    })

    test('lists the typed readings with a Delete for each', () => {
      renderInGroup(<EnergyReadingsPage />)
      const list = screen.getByRole('region', { name: 'Typed readings' })
      expect(list).toHaveTextContent('From the grid, off-peak')
      expect(list).toHaveTextContent('24,250.4 kWh on November 10, 2026')
      expect(
        screen.getByRole('button', {
          name: 'Delete From the grid, off-peak on November 10, 2026',
        }),
      ).toBeInTheDocument()
    })

    test('asks first, and Cancel deletes nothing', () => {
      renderInGroup(<EnergyReadingsPage />)
      fireEvent.click(
        screen.getByRole('button', { name: /^Delete From the grid/ }),
      )
      const dialog = screen.getByRole('dialog', { name: 'Delete this reading?' })
      expect(dialog).toHaveTextContent(
        'From the grid, off-peak: 24,250.4 kWh on November 10, 2026. Usage and costs for the days around it are worked out again without it.',
      )
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(state.calls).toEqual([])
    })

    test('confirming deletes that one reading', async () => {
      renderInGroup(<EnergyReadingsPage />, { locale: 'nl' })
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Stroom van het net, dal van 10 november 2026 verwijderen',
        }),
      )
      screen.getByRole('dialog', { name: 'Deze stand verwijderen?' })
      fireEvent.click(screen.getByRole('button', { name: 'Verwijderen' }))
      await waitFor(() =>
        expect(state.calls).toEqual([
          {
            name: 'energyReadings:remove',
            args: { groupSlug: 'jansen-household', readingId: 'r1' },
          },
        ]),
      )
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      )
    })

    test('a refusal keeps the dialog open and says why', async () => {
      state.result = Promise.reject(
        Object.assign(new Error('refused'), {
          data: { kind: 'energy:readingNotFound' },
        }),
      )
      state.result.catch(() => {})
      renderInGroup(<EnergyReadingsPage />)
      fireEvent.click(
        screen.getByRole('button', { name: /^Delete From the grid/ }),
      )
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'That reading is not there any more.',
      )
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })
})
