import { expect, test } from 'vitest'

import { en } from '../../i18n/messages/en'
import { nl } from '../../i18n/messages/nl'
import { detailWords } from './detailWords'

test('a grocery item is an item, in both languages', () => {
  expect(detailWords(nl, true)).toEqual({
    titlePlaceholder: 'Wat heb je nodig?',
    delete: 'Item verwijderen',
  })
  expect(detailWords(en, true)).toEqual({
    titlePlaceholder: 'What do you need?',
    delete: 'Delete item',
  })
})

test('any other list keeps the task wording', () => {
  expect(detailWords(nl, false)).toEqual({
    titlePlaceholder: 'Wat moet er gebeuren?',
    delete: 'Taak verwijderen',
  })
  expect(detailWords(en, false).delete).toBe('Delete task')
})
