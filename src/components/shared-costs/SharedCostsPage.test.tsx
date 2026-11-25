import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'
import { renderInGroup } from '../app/testing'
import { SharedCostsPage } from './SharedCostsPage'

const state = vi.hoisted(() => ({
  queries: {} as Record<string, unknown>,
  calls: [] as [string, Record<string, unknown>][],
  fail: false,
}))

vi.mock('../../../convex/_generated/api', () => {
  const module = (name: string) =>
    new Proxy({}, { get: (_, key) => `${name}:${String(key)}` })
  return { api: new Proxy({}, { get: (_, key) => module(String(key)) }) }
})
vi.mock('convex/react', () => ({
  useQuery: (name: string) => state.queries[name],
  useMutation: (name: string) => async (args: Record<string, unknown>) => {
    state.calls.push([name, args])
    if (state.fail) throw new Error('nope')
  },
}))
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => async () => {},
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

const nora = { userId: 'n', name: 'Nora' }
const sam = { userId: 's', name: 'Sam' }
const SAVED = {
  _id: 'k1',
  name: 'Ski trip',
  createdAt: Date.UTC(2025, 0, 2, 12),
  payments: [{ party: sam, amountCents: 5000, label: 'Cottage' }],
  participants: [nora, sam],
  mode: 'equal',
  owed: [
    { party: nora, amountCents: 2500 },
    { party: sam, amountCents: 2500 },
  ],
  transfers: [{ from: nora, to: sam, amountCents: 2500 }],
  totalCents: 5000,
}

beforeEach(() => {
  state.calls = []
  state.fail = false
  state.queries = {
    'groups:members': [nora, sam],
    'splitScenarios:list': [SAVED],
  }
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
})

const button = (name: string | RegExp, root = screen.getByRole('main')) =>
  within(root).getByRole('button', { name })

const show = (openSplitId?: string, locale: 'en' | 'nl' = 'en') =>
  renderInGroup(
    <main>
      <SharedCostsPage openSplitId={openSplitId} />
    </main>,
    { locale },
  )

function pay(amount: string) {
  fireEvent.click(button('Add a payment'))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Amount'), {
    target: { value: amount },
  })
  fireEvent.click(button('Add', dialog))
}

test('stores nothing until it is saved, and then the frozen figures', async () => {
  show()
  pay('0')
  expect(screen.getByText('That has to be more than nothing.')).toBeDefined()
  fireEvent.click(button('Cancel'))
  pay('10,00')
  expect(screen.getByText('Sam pays Nora')).toBeDefined()
  expect(state.calls).toEqual([])

  fireEvent.click(screen.getAllByRole('button', { name: 'Save this' })[0])
  const dialog = screen.getByRole('dialog')
  fireEvent.click(button('Save', dialog))
  expect(screen.getByText('Give it a name.')).toBeDefined()
  fireEvent.change(within(dialog).getByLabelText('What to call it'), {
    target: { value: ' Cake ' },
  })
  fireEvent.click(button('Save', dialog))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(state.calls).toEqual([
    [
      'splitScenarios:save',
      expect.objectContaining({
        groupSlug: 'jansen-household',
        name: 'Cake',
        totalCents: 1000,
        mode: 'equal',
        transfers: [{ from: sam, to: nora, amountCents: 500 }],
      }),
    ],
  ])
})

test('a refused save keeps the dialog open and says so', async () => {
  state.fail = true
  show()
  pay('10')
  fireEvent.click(screen.getAllByRole('button', { name: 'Save this' })[0])
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('What to call it'), {
    target: { value: 'Cake' },
  })
  fireEvent.click(button('Save', dialog))
  expect(await within(dialog).findByRole('alert')).toBeDefined()
})

test('custom starts from the equal split and has to add up', () => {
  show()
  pay('10')
  fireEvent.click(button('Custom'))
  const amount = screen.getByLabelText('Amount for Nora') as HTMLInputElement
  expect(amount.value).toBe('5')
  fireEvent.change(amount, { target: { value: '4' } })
  expect(
    screen.getAllByText('The amounts have to add up to what was paid.'),
  ).toHaveLength(2)
  for (const save of screen.getAllByRole('button', { name: 'Save this' }))
    expect((save as HTMLButtonElement).disabled).toBe(true)
})

test('a saved split opens read-only and duplicates into the calculator', () => {
  show('k1')
  const record = screen.getByRole('complementary', { name: 'Ski trip' })
  expect(within(record).queryByRole('textbox')).toBeNull()
  expect(within(record).getByText('Nora pays Sam')).toBeDefined()
  fireEvent.click(button('Duplicate', record))
  expect(
    (screen.getByLabelText('What was it for') as HTMLInputElement).value,
  ).toBe('Ski trip')
  expect(button('Remove €50.00 from Sam')).toBeDefined()
  expect(state.calls).toEqual([])
})

test('an address naming no split here says Not found', () => {
  show('gone')
  expect(screen.getByText('Not found')).toBeDefined()
})

test('euros are written the Dutch way in Dutch', () => {
  show(undefined, 'nl')
  expect(screen.getByText(/2 jan 2025 · €\s50,00/)).toBeDefined()
})
