import { describe, expect, test } from 'vitest'
import { WIDGETS } from './modules'
import {
  resolveDashboard,
  validateWidgetInstances,
  type WidgetInstance,
} from './widgets'

describe('widget selectors', () => {
  test('rejects an unavailable widget size', () => {
    expect(() =>
      validateWidgetInstances(
        [
          {
            instanceId: 'one',
            widgetDefinitionId: 'calendar.upcoming',
            size: 'compact',
          },
        ],
        WIDGETS,
      ),
    ).toThrow('calendar.upcoming does not support compact')
  })

  test('personal empty dashboard overrides rather than inherits defaults', () => {
    const shared: WidgetInstance[] = [
      {
        instanceId: 'default:tasks.today',
        widgetDefinitionId: 'tasks.today',
        size: 'standard',
      },
    ]
    expect(resolveDashboard(shared, [])).toEqual([])
    expect(resolveDashboard(shared, undefined)).toEqual(shared)
  })

  test('rejects duplicate single-instance widgets', () => {
    expect(() =>
      validateWidgetInstances(
        [
          {
            instanceId: 'one',
            widgetDefinitionId: 'calendar.upcoming',
            size: 'standard',
          },
          {
            instanceId: 'two',
            widgetDefinitionId: 'calendar.upcoming',
            size: 'wide',
          },
        ],
        WIDGETS,
      ),
    ).toThrow('calendar.upcoming can only appear once')
  })
})
