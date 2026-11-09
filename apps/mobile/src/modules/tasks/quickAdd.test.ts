import { describe, expect, test } from 'vitest'

import { quickAddLists, quickAddTarget } from './quickAdd'

const list = (id: string, order: number, writable = true) => ({
  _id: id,
  name: id,
  order,
  writable,
})

describe("the Add tab's task lists", () => {
  test('offers only lists Gather can write to, in list order', () => {
    const lists = [list('b', 2), list('notion', 0, false), list('a', 1)]
    expect(quickAddLists(lists).map(({ _id }) => _id)).toEqual(['a', 'b'])
  })

  test('aims at the first list until somebody picks another', () => {
    const lists = quickAddLists([list('a', 0), list('b', 1)])
    expect(quickAddTarget(lists, null)?._id).toBe('a')
    expect(quickAddTarget(lists, 'b')?._id).toBe('b')
  })

  test('falls back to the first list when the pick is no longer offered', () => {
    const lists = quickAddLists([list('a', 0), list('gone', 1, false)])
    expect(quickAddTarget(lists, 'gone')?._id).toBe('a')
  })

  test('has nowhere to aim when no list is writable', () => {
    expect(quickAddTarget(quickAddLists([list('n', 0, false)]), null)).toBe(
      undefined,
    )
  })
})
