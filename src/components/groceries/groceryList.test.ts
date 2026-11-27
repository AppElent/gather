import { describe, expect, test } from 'vitest'
import { formatAmountDraft, moveItem, parseAmountDraft } from './groceryList'

describe('an amount in the item editor', () => {
  test('is written and read in the reader’s notation', () => {
    expect(formatAmountDraft(1.5, 'nl')).toBe('1,5')
    expect(formatAmountDraft(1500, 'en')).toBe('1500')
    expect(formatAmountDraft(undefined, 'en')).toBe('')
    expect(parseAmountDraft('1,5')).toBe(1.5)
    expect(parseAmountDraft(' 1.5 ')).toBe(1.5)
  })

  test('empty is no amount; anything else is refused', () => {
    expect(parseAmountDraft('')).toBeNull()
    for (const typed of ['0', '-1', 'two', '1.', '1e9', '1,5,0'])
      expect(parseAmountDraft(typed)).toBeUndefined()
  })
})

test('moveItem moves one and leaves the list alone past an end', () => {
  expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
  expect(moveItem(['a', 'b'], 1, 2)).toEqual(['a', 'b'])
})
