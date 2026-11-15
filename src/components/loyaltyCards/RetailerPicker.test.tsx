import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import type { RetailerSuggestion } from '../../../convex/loyaltyCards'
import { renderWithI18n } from '../../lib/i18n/testing'
import { RetailerPicker } from './RetailerPicker'

/**
 * The picker's results change under the person's fingers, so a screen reader
 * is told how many stores the search found, not left to discover it.
 */

const answer: { value: RetailerSuggestion[] | undefined } = { value: [] }

vi.mock('convex/react', () => ({
  useQuery: () => answer.value,
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: { loyaltyCards: { searchCatalog: 'loyaltyCards:searchCatalog' } },
}))

const KRUIDVAT: RetailerSuggestion = {
  seedKey: 'kruidvat',
  name: 'Kruidvat',
  aliases: [],
  category: 'drugstore',
  brandColor: '#e2001a',
  domain: 'kruidvat.nl',
  barcodeFormat: 'CODE_128',
  formatConfidence: 'guess',
}

describe('the search results', () => {
  test('are announced as a count', () => {
    answer.value = [KRUIDVAT]
    renderWithI18n(<RetailerPicker onPick={vi.fn()} onOtherStore={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Stores found: 1.')
  })

  test('announce when nothing matches', () => {
    answer.value = []
    renderWithI18n(<RetailerPicker onPick={vi.fn()} onOtherStore={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Find your store'), {
      target: { value: 'zzz' },
    })
    expect(screen.getByRole('status')).toHaveTextContent(
      'No store matches “zzz”.',
    )
  })
})
