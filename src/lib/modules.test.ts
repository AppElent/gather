import { describe, expect, test } from 'vitest'
import { getModuleDefinition, MODULES } from './modules'
import { createNewSpaceModuleStates, getVisibleModuleIds } from './spaceModules'

describe('module registry', () => {
  test('every module has a unique id and path segment', () => {
    const ids = new Set(MODULES.map((m) => m.id))
    const pathSegments = new Set(MODULES.map((m) => m.pathSegment))
    expect(ids.size).toBe(MODULES.length)
    expect(pathSegments.size).toBe(MODULES.length)
  })

  test('returns module definitions by id', () => {
    expect(getModuleDefinition('recipes')?.label).toBe('Recipes')
    expect(getModuleDefinition('nutrition')?.label).toBe('Nutrition')
    expect(getModuleDefinition('missing')).toBeUndefined()
  })

  test('tasks notes and calendar are defaults for new Spaces', () => {
    expect(
      MODULES.filter((module) => module.defaultForNewSpaces).map(
        (module) => module.id,
      ),
    ).toEqual(['tasks', 'notes', 'calendar'])
  })

  test('recipes and nutrition are the live modules', () => {
    const live = MODULES.filter((module) => module.availability === 'live').map(
      (module) => module.id,
    )
    expect(live).toEqual(['recipes', 'nutrition'])
  })

  test('recipes is live and non-default initially', () => {
    expect(getModuleDefinition('recipes')).toMatchObject({
      availability: 'live',
      defaultForNewSpaces: false,
    })
  })

  test('pre-enables coming-soon defaults without exposing them', () => {
    expect(createNewSpaceModuleStates(MODULES)).toContainEqual({
      moduleId: 'calendar',
      state: 'preEnabled',
    })
    expect(
      getVisibleModuleIds(MODULES, [
        { moduleId: 'calendar', state: 'preEnabled' },
      ]),
    ).not.toContain('calendar')
  })

  test('promotes a pre-enabled module when its catalog entry becomes live', () => {
    const catalog = MODULES.map((item) =>
      item.id === 'calendar'
        ? { ...item, availability: 'live' as const }
        : item,
    )
    expect(
      getVisibleModuleIds(catalog, [
        { moduleId: 'calendar', state: 'preEnabled' },
      ]),
    ).toContain('calendar')
  })
})
