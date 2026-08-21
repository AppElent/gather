import { describe, expect, test } from 'vitest'

import { hideSlot, showAllSlots } from './logBarState'

describe('log bar visibility', () => {
  test('hides one item without changing the order of the others', () => {
    expect(hideSlot(['feed', 'todo', 'sleep'], 'todo')).toEqual([
      'feed',
      'sleep',
    ])
  })

  test('restores every missing event then every missing shortcut after the current order', () => {
    expect(
      showAllSlots(['sleep', 'todo'], ['feed', 'sleep'], ['todo', 'question']),
    ).toEqual(['sleep', 'todo', 'feed', 'question'])
  })
})
