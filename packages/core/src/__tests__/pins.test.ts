import { describe, expect, test } from 'vitest'
import {
  DEFAULT_PINS,
  isPinned,
  movePin,
  pinnedModuleIds,
  pinnedModules,
  togglePin,
} from '../pins'

describe('what a person has pinned', () => {
  test('is a sensible default before they have chosen anything', () => {
    expect(pinnedModuleIds(undefined)).toEqual([...DEFAULT_PINS])
    expect(pinnedModules(undefined).map((m) => m.id)).toEqual([
      'recipes',
      'tasks',
    ])
  })

  test('never defaults to a Module that is not built yet', () => {
    for (const module of pinnedModules(undefined)) {
      expect(module.status).toBe('live')
    }
  })

  test('is empty when they have chosen to keep none', () => {
    expect(pinnedModuleIds([])).toEqual([])
    expect(pinnedModules([])).toEqual([])
  })

  test('is their order, not the catalog order', () => {
    expect(pinnedModuleIds(['notes', 'baby-log', 'recipes'])).toEqual([
      'notes',
      'baby-log',
      'recipes',
    ])
  })

  test('ignores a Pin no Module declares rather than breaking the list', () => {
    expect(pinnedModuleIds(['recipes', 'seances', 'tasks'])).toEqual([
      'recipes',
      'tasks',
    ])
    expect(pinnedModules(['seances'])).toEqual([])
  })

  test('keeps a repeated id once, in its first position', () => {
    expect(pinnedModuleIds(['recipes', 'tasks', 'recipes'])).toEqual([
      'recipes',
      'tasks',
    ])
  })

  test('answers whether a given Module is pinned', () => {
    expect(isPinned(['recipes'], 'recipes')).toBe(true)
    expect(isPinned(['recipes'], 'tasks')).toBe(false)
    // Someone who has never chosen still has the default pinned.
    expect(isPinned(undefined, DEFAULT_PINS[0])).toBe(true)
  })

  test('drops a Pin left behind by the retired Nutrition Module', () => {
    expect(pinnedModuleIds(['recipes', 'nutrition', 'tasks'])).toEqual([
      'recipes',
      'tasks',
    ])
  })
})

describe('editing pins', () => {
  test('adds a Module that was not pinned, at the end', () => {
    expect(togglePin(['recipes', 'tasks'], 'wines')).toEqual([
      'recipes',
      'tasks',
      'wines',
    ])
  })

  test('removes a Module that was pinned, leaving the rest in order', () => {
    expect(togglePin(['recipes', 'tasks', 'nutrition'], 'tasks')).toEqual([
      'recipes',
      'nutrition',
    ])
  })

  test('leaves the list it was given alone', () => {
    const before = ['recipes', 'tasks']
    togglePin(before, 'wines')
    movePin(before, 'tasks', 'up')
    expect(before).toEqual(['recipes', 'tasks'])
  })

  test('moves a Module one place up or down', () => {
    const ids = ['recipes', 'tasks', 'nutrition']
    expect(movePin(ids, 'tasks', 'up')).toEqual([
      'tasks',
      'recipes',
      'nutrition',
    ])
    expect(movePin(ids, 'tasks', 'down')).toEqual([
      'recipes',
      'nutrition',
      'tasks',
    ])
  })

  test('does nothing at the ends, or for a Module that is not pinned', () => {
    const ids = ['recipes', 'tasks']
    expect(movePin(ids, 'recipes', 'up')).toEqual(ids)
    expect(movePin(ids, 'tasks', 'down')).toEqual(ids)
    expect(movePin(ids, 'wines', 'up')).toEqual(ids)
  })

  test('a first edit by someone who never chose starts from the default', () => {
    const start = pinnedModuleIds(undefined)
    expect(togglePin(start, 'baby-log')).toEqual([...DEFAULT_PINS, 'baby-log'])
    expect(togglePin(start, DEFAULT_PINS[0])).toEqual(DEFAULT_PINS.slice(1))
  })
})
