import { describe, expect, test } from 'vitest'
import { moduleDestination } from './moduleDestination'

describe('moduleDestination', () => {
  test('sends native Modules to the All stack', () => {
    expect(moduleDestination('tasks')).toBe('/all/tasks')
    expect(moduleDestination('notes')).toBe('/all/notes')
    expect(moduleDestination('baby-log')).toBe('/all/baby-log')
  })

  test('keeps placeholders on the All dynamic route', () => {
    expect(moduleDestination('calendar')).toEqual({
      pathname: '/all/[moduleId]',
      params: { moduleId: 'calendar' },
    })
  })
})
