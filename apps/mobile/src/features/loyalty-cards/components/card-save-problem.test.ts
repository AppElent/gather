import { ConvexError } from 'convex/values'
import { expect, test } from 'vitest'

import { cardSaveProblem } from './card-save-problem'

const words = {
  saveFailed: 'Could not save.',
  refusals: { 'loyalty:needsStore': 'Enter the store.' },
}

test('says the refusal Convex gave', () => {
  expect(
    cardSaveProblem(new ConvexError({ kind: 'loyalty:needsStore' }), words),
  ).toBe('Enter the store.')
})

test('falls back to the plain failure', () => {
  expect(cardSaveProblem(new Error('offline'), words)).toBe('Could not save.')
  expect(
    cardSaveProblem(new ConvexError({ kind: 'calendar:other' }), words),
  ).toBe('Could not save.')
})
