import { en, nl } from '@gather/core/messages'
import {
  GROUP_REFUSAL_CODES,
  groupRefusal,
  refusal,
  tastingAttributeRefusal,
} from '@gather/core/refusals'
import { renderHook } from '@testing-library/react'
import { ConvexError } from 'convex/values'
import type { ReactNode } from 'react'
import { describe, expect, test } from 'vitest'
import { errorMessage, useErrorMessage } from './errorMessage'
import { type Locale, LocaleProvider } from './i18n'

const FALLBACK = 'Something went wrong'

describe('a refused tasting', () => {
  const { problems } = en.tastings.composer

  test('reads as what was wrong with the attribute', () => {
    const error = new ConvexError(
      tastingAttributeRefusal({ field: 'abv', problem: 'outOfRange' }),
    )

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

describe('a refused Group (APP-429)', () => {
  const error = new ConvexError(
    groupRefusal('not-a-member', 'Not a member of that group'),
  )

  test('still shows the sentence it showed before it was keyed', () => {
    expect(errorMessage(error, FALLBACK)).toBe('Not a member of that group')
  })

  test('reads from the caller’s wording when it has one for the kind', () => {
    expect(
      errorMessage(error, FALLBACK, { 'groups:not-a-member': 'Not yours' }),
    ).toBe('Not yours')
  })
})

describe('a refused Group in the reader’s language (APP-580)', () => {
  function errorText(locale: Locale) {
    const { result } = renderHook(() => useErrorMessage(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      ),
    })
    return result.current
  }

  test('every kind has its own sentence, in English and in Dutch', () => {
    for (const [locale, messages] of [
      ['en', en],
      ['nl', nl],
    ] as const) {
      for (const code of GROUP_REFUSAL_CODES) {
        const error = new ConvexError(groupRefusal(code, 'English sentence'))
        expect(errorText(locale)(error, FALLBACK)).toBe(
          messages.common.errors.groupRefusals[code],
        )
      }
    }
  })

  test('a caller’s own sentence for the kind still wins', () => {
    const error = new ConvexError(
      groupRefusal('not-a-member', 'Not a member of that group'),
    )
    expect(
      errorText('nl')(error, FALLBACK, { 'groups:not-a-member': 'Niet de jouwe' }),
    ).toBe('Niet de jouwe')
  })

  test('anything else reads as it did', () => {
    expect(errorText('nl')(new Error('Boom'), FALLBACK)).toBe('Boom')
  })
})
