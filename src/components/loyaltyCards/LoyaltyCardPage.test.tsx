import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderInGroup, TEST_GROUP } from '../app/testing'
import { LoyaltyCardPage, validateLoyaltyCardSearch } from './LoyaltyCardPage'

/**
 * Showing a card is using it; saving one is not (APP-153). The card page
 * records a use on open, except when it was reached straight from the form.
 */

const state = vi.hoisted(() => ({
  marked: [] as unknown[],
  navigated: [] as unknown[],
}))

const CARD = {
  _id: 'c1',
  storeName: 'Albert Heijn',
  brandColor: '#00a0e2',
  cardNumber: '2620187342052',
  barcodeFormat: 'EAN_13',
  hasPhotos: false,
  frontPhotoUrl: null,
  backPhotoUrl: null,
}

vi.mock('convex/react', () => {
  const markUsed = async (args: unknown) => {
    state.marked.push(args)
  }
  return { useQuery: () => CARD, useMutation: () => markUsed }
})

vi.mock('../../../convex/_generated/api', () => ({
  api: { loyaltyCards: { get: 'get', markUsed: 'markUsed' } },
}))

vi.mock('@tanstack/react-router', () => {
  const navigate = (options: unknown) => {
    state.navigated.push(options)
  }
  return {
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
    useNavigate: () => navigate,
  }
})

vi.mock('./Barcode', () => ({ Barcode: () => <div /> }))

beforeEach(() => {
  state.marked = []
  state.navigated = []
})

describe('LoyaltyCardPage', () => {
  test('opening a card counts as using it', async () => {
    renderInGroup(<LoyaltyCardPage cardId="c1" />)
    await waitFor(() =>
      expect(state.marked).toEqual([{ groupSlug: TEST_GROUP.slug, id: 'c1' }]),
    )
    expect(state.navigated).toEqual([])
  })

  test('arriving from saving the card does not, and drops the flag', async () => {
    renderInGroup(<LoyaltyCardPage cardId="c1" justSaved />)
    expect(await screen.findByText('Not used yet')).toBeVisible()
    await waitFor(() =>
      expect(state.navigated).toEqual([
        {
          to: '/loyalty-cards/$cardId',
          params: { cardId: 'c1' },
          replace: true,
        },
      ]),
    )
    expect(state.marked).toEqual([])
  })
})

test('only `saved=true` in the address counts as arriving from a save', () => {
  expect(validateLoyaltyCardSearch({ saved: true })).toEqual({ saved: true })
  expect(validateLoyaltyCardSearch({ saved: 'yes' })).toEqual({})
  expect(validateLoyaltyCardSearch({})).toEqual({})
})
