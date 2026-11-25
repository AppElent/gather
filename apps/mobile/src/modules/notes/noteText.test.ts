import { expect, test } from 'vitest'
import { unsavedText } from './noteText'

test('only the fields that differ from the saved note', () => {
  const saved = { title: 'T', body: 'b' }
  expect(unsavedText(saved, { title: 'T', body: 'c' })).toEqual({ body: 'c' })
  expect(unsavedText(saved, { title: '' })).toEqual({ title: '' })
  expect(unsavedText(saved, {})).toEqual({})
})
