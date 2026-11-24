import { describe, expect, test } from 'vitest'

import { hideSlot, showAllSlots, slotMenuKey } from './logBarState'

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

describe('log bar menu key', () => {
  test('changes with the label, so a language switch remounts the menu', () => {
    expect(slotMenuKey('feed', 'Feed')).not.toBe(slotMenuKey('feed', 'Voeding'))
  })

  test('stays the same while the label does, and differs between slots', () => {
    expect(slotMenuKey('feed', 'Feed')).toBe(slotMenuKey('feed', 'Feed'))
    expect(slotMenuKey('feed', 'Log')).not.toBe(slotMenuKey('sleep', 'Log'))
  })
})
