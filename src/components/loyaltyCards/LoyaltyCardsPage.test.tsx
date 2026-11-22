import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderInGroup } from '../app/testing'
import { LoyaltyCardsPage } from './LoyaltyCardsPage'

/**
 * The card list shows what Convex sorted, as tiles a person can tell apart at
 * a glance, and narrows by store or holder without asking the server again.
 */

const loaded = vi.hoisted(() => ({ value: undefined as unknown }))
type Update = (
  store: {
    getQuery: (query: unknown, args: unknown) => unknown
    setQuery: (query: unknown, args: unknown, value: unknown) => void
  },
  args: { groupSlug: string; ids: string[] },
) => void
const reorder = vi.hoisted(() => ({
  calls: [] as unknown[],
  result: Promise.resolve() as Promise<unknown>,
  update: undefined as unknown,
}))

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
  useMutation: () => {
    const run = (args: unknown) => {
      reorder.calls.push(args)
      return reorder.result
    }
    return Object.assign(run, {
      withOptimisticUpdate: (update: unknown) => {
        reorder.update = update
        return run
      },
    })
  },
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    loyaltyCards: {
      list: 'loyaltyCards:list',
      reorder: 'loyaltyCards:reorder',
    },
  },
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
  reorder.calls = []
  reorder.result = Promise.resolve()
  reorder.update = undefined
})

/** What Convex's client does with the updater: run it on the current result
 * and show what it sets, until the mutation settles. */
function applyOptimisticUpdate(ids: string[]) {
  const before = loaded.value
  ;(reorder.update as Update)(
    {
      getQuery: () => before,
      setQuery: (_query, _args, value) => {
        loaded.value = value
      },
    },
    { groupSlug: 'home', ids },
  )
  return before
}

const shownStores = () =>
  screen
    .getAllByRole('listitem')
    .map((item) => item.querySelector('.font-semibold')?.textContent)

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

  describe('Reorder (APP-440)', () => {
    test('moves a card with keyboard-reachable buttons and saves the full order', () => {
      renderInGroup(<LoyaltyCardsPage />)
      fireEvent.click(screen.getByRole('button', { name: 'Reorder' }))

      // The mode replaces the filter and the links.
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
      expect(cardLinks()).toHaveLength(0)
      expect(
        screen.getByRole('button', { name: 'Move Albert Heijn (Nora) up' }),
      ).toBeDisabled()
      expect(
        screen.getByRole('button', { name: 'Move Bakkerij De Graaf down' }),
      ).toBeDisabled()

      fireEvent.click(
        screen.getByRole('button', { name: 'Move Bakkerij De Graaf up' }),
      )
      expect(reorder.calls).toEqual([
        { groupSlug: expect.any(String), ids: ['c1', 'c3', 'c2'] },
      ])

      fireEvent.click(screen.getByRole('button', { name: 'Done' }))
      expect(cardLinks()).toHaveLength(3)
    })

    test('says where a card went, to a screen reader, after each move', () => {
      renderInGroup(<LoyaltyCardsPage />)
      fireEvent.click(screen.getByRole('button', { name: 'Reorder' }))
      const region = screen.getByRole('status')
      expect(region).toHaveAttribute('aria-live', 'polite')
      expect(region).toBeEmptyDOMElement()

      fireEvent.click(
        screen.getByRole('button', { name: 'Move Bakkerij De Graaf up' }),
      )
      expect(region).toHaveTextContent(
        'Bakkerij De Graaf moved to position 2 of 3',
      )
      fireEvent.click(
        screen.getByRole('button', { name: 'Move Albert Heijn (Nora) down' }),
      )
      expect(region).toHaveTextContent(
        'Albert Heijn (Nora) moved to position 2 of 3',
      )
    })

    test('shows the new order before Convex answers, and the old one back when the save is refused', async () => {
      let refuse: (reason: Error) => void = () => {}
      reorder.result = new Promise((_resolve, reject) => {
        refuse = reject
      })
      const { rerender } = renderInGroup(<LoyaltyCardsPage />)
      fireEvent.click(screen.getByRole('button', { name: 'Reorder' }))
      fireEvent.click(
        screen.getByRole('button', { name: 'Move Bakkerij De Graaf up' }),
      )

      const server = applyOptimisticUpdate(['c1', 'c3', 'c2'])
      rerender(<LoyaltyCardsPage />)
      expect(shownStores()).toEqual([
        'Albert Heijn',
        'Bakkerij De Graaf',
        'Albert Heijn',
      ])
      expect(
        screen.getByRole('button', { name: 'Move Bakkerij De Graaf up' }),
      ).toBeEnabled()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(
        (loaded.value as { _id: string }[]).map((card) => card._id),
      ).toEqual(['c1', 'c3', 'c2'])
      // The updater builds a new list; the Convex result it read is untouched.
      expect((server as { _id: string }[]).map((card) => card._id)).toEqual([
        'c1',
        'c2',
        'c3',
      ])

      // Refused: Convex drops the optimistic layer, the page says so.
      refuse(new Error('refused'))
      loaded.value = server
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'That did not work',
      )
      rerender(<LoyaltyCardsPage />)
      expect(shownStores()).toEqual([
        'Albert Heijn',
        'Albert Heijn',
        'Bakkerij De Graaf',
      ])
      // Nothing is said as though the card had moved.
      expect(screen.getByRole('status')).toBeEmptyDOMElement()
    })

    test('while the save is still waiting for the connection, the new order stays and nothing is refused', async () => {
      reorder.result = new Promise(() => {})
      const { rerender } = renderInGroup(<LoyaltyCardsPage />)
      fireEvent.click(screen.getByRole('button', { name: 'Reorder' }))
      fireEvent.click(
        screen.getByRole('button', { name: 'Move Bakkerij De Graaf up' }),
      )
      applyOptimisticUpdate(['c1', 'c3', 'c2'])
      rerender(<LoyaltyCardsPage />)
      await Promise.resolve()
      expect(shownStores()).toEqual([
        'Albert Heijn',
        'Bakkerij De Graaf',
        'Albert Heijn',
      ])
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    test('the optimistic update leaves a card list that is not loaded yet alone', () => {
      renderInGroup(<LoyaltyCardsPage />)
      const written: unknown[] = []
      ;(reorder.update as Update)(
        {
          getQuery: () => undefined,
          setQuery: (_query, _args, value) => written.push(value),
        },
        { groupSlug: 'home', ids: ['c3', 'c1'] },
      )
      expect(written).toEqual([])
    })

    test('keeps keyboard focus on the card when it reaches an end', () => {
      renderInGroup(<LoyaltyCardsPage />)
      fireEvent.click(screen.getByRole('button', { name: 'Reorder' }))
      fireEvent.click(
        screen.getByRole('button', { name: 'Move Albert Heijn (Sam) up' }),
      )
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Move Albert Heijn (Sam) down' }),
      )
    })

    test('says so when the order could not be saved', async () => {
      reorder.result = Promise.reject(new Error('offline'))
      renderInGroup(<LoyaltyCardsPage />)
      fireEvent.click(screen.getByRole('button', { name: 'Reorder' }))
      fireEvent.click(
        screen.getByRole('button', { name: 'Move Albert Heijn (Sam) up' }),
      )
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'That did not work',
      )
    })

    test('ends when the Group is down to one card, so a new card does not reopen it', () => {
      const { rerender } = renderInGroup(<LoyaltyCardsPage />)
      fireEvent.click(screen.getByRole('button', { name: 'Reorder' }))
      loaded.value = CARDS.slice(0, 1)
      rerender(<LoyaltyCardsPage />)
      loaded.value = CARDS
      rerender(<LoyaltyCardsPage />)
      expect(cardLinks()).toHaveLength(3)
      expect(screen.getByRole('button', { name: 'Reorder' })).toBeInTheDocument()
    })

    test('is not offered with fewer than two cards, or while filtering', () => {
      loaded.value = CARDS.slice(0, 1)
      const { unmount } = renderInGroup(<LoyaltyCardsPage />)
      expect(
        screen.queryByRole('button', { name: 'Reorder' }),
      ).not.toBeInTheDocument()
      unmount()

      loaded.value = CARDS
      renderInGroup(<LoyaltyCardsPage />)
      fireEvent.change(screen.getByRole('searchbox', { name: 'Filter cards' }), {
        target: { value: 'sam' },
      })
      expect(
        screen.queryByRole('button', { name: 'Reorder' }),
      ).not.toBeInTheDocument()
    })
  })
})
