import { en as coreEn } from '@gather/core/messages'
import { expect, test } from 'vitest'

import { cardLastUsed, lastUsedFirst } from './card-last-used'

const words = coreEn.shell.activity
const NOW = Date.UTC(2026, 10, 14, 12, 0, 0)
const MINUTE = 60_000

test('reads a card shown a moment ago, or from a skewed clock, as just now', () => {
  expect(cardLastUsed(NOW - 20_000, words, 'en', NOW)).toBe('Just now')
  expect(cardLastUsed(NOW + 5_000, words, 'en', NOW)).toBe('Just now')
})

test('counts minutes, then hours', () => {
  expect(cardLastUsed(NOW - MINUTE, words, 'en', NOW)).toBe('1 minute ago')
  expect(cardLastUsed(NOW - 5 * MINUTE, words, 'en', NOW)).toBe(
    '5 minutes ago',
  )
  expect(cardLastUsed(NOW - 3 * 60 * MINUTE, words, 'en', NOW)).toBe(
    '3 hours ago',
  )
})

test('says yesterday, then days, then a date', () => {
  const day = 24 * 60 * MINUTE
  expect(cardLastUsed(NOW - day, words, 'en', NOW)).toBe('Yesterday')
  expect(cardLastUsed(NOW - 3 * day, words, 'en', NOW)).toBe('3 days ago')
  expect(cardLastUsed(NOW - 30 * day, words, 'en', NOW)).toMatch(/2026/)
})

test('orders cards last used first, and keeps a saved copy as saved', () => {
  const cards = [
    { storeName: 'Kruidvat' },
    { storeName: 'Jumbo', lastUsedAt: NOW - 3 * MINUTE },
    { storeName: 'Albert Heijn', lastUsedAt: NOW - MINUTE },
  ]
  expect(lastUsedFirst(cards, true).map((c) => c.storeName)).toEqual([
    'Albert Heijn',
    'Jumbo',
    'Kruidvat',
  ])
  // A copy carries no usage: name order would be wrong, the saved order is not.
  const copy = cards.map(({ storeName }) => ({ storeName }))
  expect(lastUsedFirst(copy, false).map((c) => c.storeName)).toEqual([
    'Kruidvat',
    'Jumbo',
    'Albert Heijn',
  ])
  expect(lastUsedFirst(cards, true)).not.toBe(cards)
})
