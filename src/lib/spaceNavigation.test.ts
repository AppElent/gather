import { describe, expect, test } from 'vitest'
import {
  buildDesktopNavigation,
  buildMobileDock,
  orderAllModules,
  resolvePinnedModuleIds,
} from './spaceNavigation'

describe('Space navigation selectors', () => {
  test('personal empty pins override rather than inherit defaults', () => {
    expect(resolvePinnedModuleIds(['recipes'], [])).toEqual([])
    expect(resolvePinnedModuleIds(['recipes'], undefined)).toEqual(['recipes'])
  })

  test('mobile shows Home, three visible pins, and All', () => {
    expect(buildMobileDock(['tasks', 'notes', 'calendar', 'recipes'])).toEqual([
      'home',
      'tasks',
      'notes',
      'calendar',
      'modules',
    ])
  })

  test('desktop navigation includes all visible pins', () => {
    expect(buildDesktopNavigation(['recipes', 'notes'])).toEqual([
      'home',
      'recipes',
      'notes',
      'modules',
    ])
  })

  test('All Modules orders pinned modules first without duplicates', () => {
    expect(orderAllModules(['recipes', 'notes', 'tasks'], ['tasks'])).toEqual([
      'tasks',
      'recipes',
      'notes',
    ])
  })

  test('All Modules deduplicates repeated pins while preserving first order', () => {
    expect(
      orderAllModules(['recipes', 'notes'], ['recipes', 'recipes']),
    ).toEqual(['recipes', 'notes'])
  })
})
