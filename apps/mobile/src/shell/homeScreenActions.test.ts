import { describe, expect, test } from 'vitest'

import { en } from '../i18n/messages/en'
import { nl } from '../i18n/messages/nl'
import {
  homeScreenActionItems,
  homeScreenActionRequest,
} from './homeScreenActions'

describe("the app icon's quick actions (APP-207)", () => {
  test('are the loyalty card, a task and the sheet, in both languages', () => {
    expect(homeScreenActionItems(nl).map(({ id, title }) => [id, title])).toEqual(
      [
        ['loyalty-card', 'Klantkaart tonen'],
        ['task-new', 'Taak toevoegen'],
        ['quick', 'Snelle acties'],
      ],
    )
    expect(homeScreenActionItems(en).map(({ title }) => title)).toEqual([
      'Show loyalty card',
      'Add task',
      'Quick actions',
    ])
  })

  // iOS shows four at most, beside the system's own items.
  test('fit the menu, each with an SF Symbol', () => {
    const items = homeScreenActionItems(en)
    expect(items.length).toBeLessThanOrEqual(4)
    for (const item of items) expect(item.icon).toMatch(/^symbol:[a-z.]+$/)
  })

  test('open the quick-actions sheet, "Add task" with its form', () => {
    expect(homeScreenActionRequest('loyalty-card')).toEqual({})
    expect(homeScreenActionRequest('quick')).toEqual({})
    expect(homeScreenActionRequest('task-new')).toEqual({ action: 'task-new' })
  })

  // An item a different build set keeps the app's normal launch.
  test('ignore an item this build does not know', () => {
    expect(homeScreenActionRequest('recipe-import')).toBeNull()
  })
})
