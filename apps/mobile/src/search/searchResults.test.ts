import { expect, test } from 'vitest'

import { en } from '../i18n/messages/en'
import { hrefFor, toRecent } from './searchResults'

test('a loyalty card opens on Search’s own stack, with its holder as detail', () => {
  const recent = toRecent(
    {
      id: 'card-1',
      type: 'loyaltyCard',
      title: 'Albert Heijn',
      tags: [],
      excerpt: 'Sam',
      creationTime: 1,
    },
    en,
  )
  expect(recent).toEqual({
    id: 'card-1',
    type: 'loyaltyCard',
    title: 'Albert Heijn',
    detail: 'Sam',
  })
  expect(hrefFor(recent)).toEqual({
    pathname: '/search/loyalty-cards/card',
    params: { cardId: 'card-1' },
  })
})
