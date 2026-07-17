import { describe, expect, test } from 'vitest'
import { MODULES } from './modules'
import {
  createNewSpaceModuleStates,
  getVisibleModuleIds,
  isModuleVisible,
} from './spaceModules'

describe('Space module states', () => {
  test('creates enabled live defaults and pre-enabled coming-soon defaults', () => {
    const states = createNewSpaceModuleStates(MODULES)
    expect(states).toEqual([
      { moduleId: 'tasks', state: 'preEnabled' },
      { moduleId: 'notes', state: 'preEnabled' },
      { moduleId: 'calendar', state: 'preEnabled' },
    ])
  })

  test('shows only enabled or pre-enabled live modules', () => {
    expect(
      getVisibleModuleIds(MODULES, [
        { moduleId: 'recipes', state: 'enabled' },
        { moduleId: 'tasks', state: 'preEnabled' },
        { moduleId: 'notes', state: 'archived' },
      ]),
    ).toEqual(['recipes'])
  })

  test('treats missing state as hidden', () => {
    const recipes = MODULES.find((module) => module.id === 'recipes')!
    expect(isModuleVisible(recipes, undefined)).toBe(false)
  })
})
