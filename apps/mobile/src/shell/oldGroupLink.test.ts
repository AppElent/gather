import { describe, expect, test } from 'vitest'

import { isOldGroupLink } from './oldGroupLink'

describe('isOldGroupLink', () => {
  test.each([
    'gather://g/jansen-household/tasks',
    'gather://g/jansen-household/tasks/task/k57abc',
    'gather:///g/jansen-household',
    'gather-dev://g/jansen-household/all/recipes',
    '/g/jansen-household/calendar/j9xyz',
    'g/jansen-household',
    '/g',
    '/g?from=mail',
  ])('%s is an old link', (path) => {
    expect(isOldGroupLink(path)).toBe(true)
  })

  test.each([
    'gather://home',
    'gather://all/tasks',
    'gather://groceries',
    '/all/groceries',
    '/settings/groups',
    'gather://quick?action=task',
    'gather://dataUrl=gatherShareKey',
    '/',
  ])('%s is not', (path) => {
    expect(isOldGroupLink(path)).toBe(false)
  })
})
