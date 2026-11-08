import { en, nl } from '@gather/core/messages'
import { refusal } from '@gather/core/refusals'
import { ConvexError } from 'convex/values'
import { describe, expect, test } from 'vitest'
import { errorMessage } from './errorMessage'

const FALLBACK = 'Something went wrong'

describe('a refused tasting', () => {
  const { problems } = en.tastings.composer

  test('reads as what was wrong with the attribute', () => {
    const error = new ConvexError({
      kind: 'tastingAttribute',
      field: 'abv',
      problem: 'outOfRange',
    })

    expect(errorMessage(error, FALLBACK, problems)).toBe(
      'That number is outside what this field allows.',
    )
  })

  test('reads as the rule when the tasting is somebody else’s', () => {
    const error = new ConvexError(refusal('notYourTasting'))

    expect(errorMessage(error, FALLBACK, problems)).toBe(
      'Only whoever logged this tasting can change it.',
    )
    expect(
      errorMessage(error, FALLBACK, nl.tastings.composer.problems),
    ).toBe('Alleen wie deze proeverij heeft vastgelegd, kan hem aanpassen.')
  })

  test('falls back when the problem has no sentence', () => {
    const error = new ConvexError({
      kind: 'tastingAttribute',
      field: 'abv',
      problem: 'somethingNew',
    })

    expect(errorMessage(error, FALLBACK, problems)).toBe(FALLBACK)
  })
})

test('a sentence the server threw is shown as written', () => {
  expect(errorMessage(new ConvexError('List not found'), FALLBACK)).toBe(
    'List not found',
  )
})
