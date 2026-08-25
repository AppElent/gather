import { describe, expect, test } from 'vitest'
import { moduleDestination } from './moduleDestination'

describe('moduleDestination', () => {
  test('sends native Modules to the All stack', () => {
    expect(moduleDestination('tasks')).toBe('/all/tasks')
    expect(moduleDestination('notes')).toBe('/all/notes')
    expect(moduleDestination('baby-log')).toBe('/all/baby-log')
    expect(moduleDestination('recipes')).toBe('/all/recipes')
    expect(moduleDestination('cheeses')).toBe('/all/tasting/cheese')
    expect(moduleDestination('meal-planner')).toBe('/all/meal-planner')
    expect(moduleDestination('groceries')).toBe('/all/groceries')
    expect(moduleDestination('pantry')).toBe('/all/pantry')
    expect(moduleDestination('calendar')).toBe('/all/calendar')
  })
})
