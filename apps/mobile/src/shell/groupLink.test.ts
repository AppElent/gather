import { MODULES } from '@gather/core/modules'
import { describe, expect, test } from 'vitest'

import { moduleDestination } from '../modules/moduleDestination'
import { nativeDestinationForGroupLink, webSegmentOf } from './groupLink'

describe('nativeDestinationForGroupLink', () => {
  test.each(MODULES.map((module) => module.id))(
    'opens %s where a tap on All would',
    (moduleId) => {
      expect(nativeDestinationForGroupLink([webSegmentOf(moduleId)])).toEqual(
        moduleDestination(moduleId),
      )
      expect(nativeDestinationForGroupLink(['all', moduleId])).toEqual(
        moduleDestination(moduleId),
      )
    },
  )

  test('a tasting link opens its Kind rather than redirecting to itself', () => {
    expect(nativeDestinationForGroupLink(['cheeses'])).toBe(
      '/all/tasting/cheese',
    )
    expect(nativeDestinationForGroupLink(['beers'])).toBe('/all/tasting/beer')
  })

  test('the web’s Baby log segment is honoured', () => {
    expect(nativeDestinationForGroupLink(['baby'])).toBe('/all/baby-log')
  })

  test('the Group root and All are their tabs', () => {
    expect(nativeDestinationForGroupLink([])).toBe('/home')
    expect(nativeDestinationForGroupLink(['all'])).toBe('/all')
  })

  test('a task or an event opens its detail screen (a notification’s tap)', () => {
    expect(nativeDestinationForGroupLink(['tasks', 'task', 'k57abc'])).toEqual({
      pathname: '/all/tasks/task/[taskId]',
      params: { taskId: 'k57abc' },
    })
    expect(nativeDestinationForGroupLink(['calendar', 'j9xyz'])).toEqual({
      pathname: '/all/calendar/[eventId]',
      params: { eventId: 'j9xyz' },
    })
  })

  test.each([
    [['tasks', 'task', '../settings']],
    [['tasks', 'k57abc']],
    [['calendar', 'j9', 'edit']],
    [['spirits']],
    [['all', 'spirits']],
    [['recipes', 'r1']],
    [['all', 'recipes', 'r1']],
    [['foods']],
  ])('refuses %j, so the Group is left alone', (segments) => {
    expect(nativeDestinationForGroupLink(segments)).toBeNull()
  })
})
