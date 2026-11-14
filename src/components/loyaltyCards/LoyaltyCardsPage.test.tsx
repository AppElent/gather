import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderInGroup } from '../app/testing'
import { LoyaltyCardsPage } from './LoyaltyCardsPage'

/**
 * The card list shows what Convex sorted, as tiles a person can tell apart at
 * a glance, and narrows by store or holder without asking the server again.
 */

const loaded = vi.hoisted(() => ({ value: undefined as unknown }))

const CARDS = [
  {
    _id: 'c1',
    storeName: 'Albert Heijn',
    brandColor: '#00a0e2',
    holder: 'Nora',
    cardNumber: '2620187342052',
    barcodeFormat: 'EAN_13',
    lastUsedAt: Date.now() - 60_000,
    hasPhotos: false,
  },
  {
    _id: 'c2',
    storeName: 'Albert Heijn',
    brandColor: '#00a0e2',
    holder: 'Sam',
    cardNumber: '2620194503163',
    barcodeFormat: 'EAN_13',
    hasPhotos: false,
  },
  {
    _id: 'c3',
    storeName: 'Bakkerij De Graaf',
    cardNumber: 'DG-004217',
    barcodeFormat: 'CODE_128',
    hasPhotos: false,
  },
]

vi.mock('convex/react', () => ({
  useQuery: () => loaded.value,
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: { loyaltyCards: { list: 'loyaltyCards:list' } },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...rest
  }: {
    children: React.ReactNode
    to: string
    params?: { cardId?: string }
  }) => (
    <a href={params?.cardId ? `/loyalty-cards/${params.cardId}` : to} {...rest}>
      {children}
    </a>
  ),
}))

beforeEach(() => {
  loaded.value = CARDS
})

const cardLinks = () =>
  screen
    .queryAllByRole('link')
    .filter((link) => link.getAttribute('href')?.startsWith('/loyalty-cards/c'))

describe('LoyaltyCardsPage', () => {
  test('shows every card in the order Convex sorted, with holder and use', () => {
    renderInGroup(<LoyaltyCardsPage />)
    const links = cardLinks()
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/loyalty-cards/c1',
      '/loyalty-cards/c2',
      '/loyalty-cards/c3',
    ])
    expect(links[0]).toHaveTextContent('Nora')
    expect(links[0]).toHaveTextContent('Last used:')
    expect(links[1]).toHaveTextContent('Not used yet')
    // The monogram is decoration: the store name is the link's text.
    expect(links[2]).toHaveTextContent('Bakkerij De Graaf')
  })

  test('narrows by store or holder, ignoring case and accents', () => {
    renderInGroup(<LoyaltyCardsPage />)
    const filter = screen.getByRole('searchbox', { name: 'Filter cards' })
    fireEvent.change(filter, { target: { value: 'SÁM' } })
    expect(cardLinks().map((link) => link.getAttribute('href'))).toEqual([
      '/loyalty-cards/c2',
    ])

    fireEvent.change(filter, { target: { value: 'zeeman' } })
    expect(screen.getByText('No card matches that.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }))
    expect(cardLinks()).toHaveLength(3)
  })

  test('an empty Group is invited to add its first card', () => {
    loaded.value = []
    renderInGroup(<LoyaltyCardsPage />)
    expect(
      screen.getByRole('heading', { name: 'No cards yet' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Add your first card' }),
    ).toHaveAttribute('href', '/loyalty-cards/new')
  })
})
