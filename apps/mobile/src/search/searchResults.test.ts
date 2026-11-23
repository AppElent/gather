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

test('a search pushed from a Module opens its results on All’s stack', () => {
  expect(
    hrefFor({ id: 'task-1', type: 'task', title: 'Milk', detail: '' }, 'all'),
  ).toEqual({
    pathname: '/all/tasks/task/[taskId]',
    params: { taskId: 'task-1' },
  })
  expect(
    hrefFor(
      { id: 's-1', type: 'tasting', title: 'Rioja', detail: '', kind: 'wine' },
      'all',
    ),
  ).toEqual({
    pathname: '/all/tasting/[kind]/subject',
    params: { kind: 'wine', subjectId: 's-1' },
  })
})
