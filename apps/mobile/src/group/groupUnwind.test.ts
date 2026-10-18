import { describe, expect, test } from 'vitest'

import { groupUnwindActions, type NavState } from './groupUnwind'

function stack(key: string, names: string[]): NavState {
  return {
    key,
    type: 'stack',
    index: names.length - 1,
    routeNames: ['index', 'recipes/recipe'],
    routes: names.map((name, i) => ({
      key: `${name}-${key}-${i}`,
      name,
      params: name === 'index' ? undefined : { id: 'r1' },
    })),
    stale: false,
  }
}

/** The shape expo-router gives the phone: root → (app) stack → tabs. */
function rootWith(tabRoutes: NavState['routes']): NavState {
  return {
    key: 'root',
    type: 'stack',
    routes: [
      {
        key: '(app)-1',
        name: '(app)',
        state: {
          key: 'app',
          type: 'stack',
          routes: [
            {
              key: '(tabs)-1',
              name: '(tabs)',
              state: { key: 'tabs', type: 'tab', routes: tabRoutes },
            },
          ],
        },
      },
    ],
  }
}

describe('groupUnwindActions', () => {
  test('resets every Group-scoped stack to a fresh root, targeted at the stack', () => {
    const root = rootWith([
      { key: 'home-t', name: 'home', state: stack('home-s', ['index']) },
      {
        key: 'all-t',
        name: 'all',
        state: stack('all-s', ['index', 'recipes/recipe']),
      },
      { key: 'search-t', name: 'search', state: stack('search-s', ['index']) },
    ])

    const actions = groupUnwindActions(root)

    expect(actions.map((action) => action.target)).toEqual([
      'home-s',
      'all-s',
      'search-s',
    ])
    const all = actions[1]
    expect(all.type).toBe('RESET')
    expect(all.payload.index).toBe(0)
    expect(all.payload.routes).toEqual([{ name: 'index' }])
  })

  test('keeps the stack itself: same key, same route names, not stale', () => {
    const root = rootWith([
      {
        key: 'all-t',
        name: 'all',
        state: stack('all-s', ['index', 'recipes/recipe']),
      },
    ])

    const [action] = groupUnwindActions(root)

    expect(action.payload.key).toBe('all-s')
    expect(action.payload.routeNames).toEqual(['index', 'recipes/recipe'])
    expect(action.payload.stale).toBe(false)
  })

  test('drops the root route key so the root screen remounts', () => {
    const root = rootWith([
      { key: 'search-t', name: 'search', state: stack('search-s', ['index']) },
    ])

    const [action] = groupUnwindActions(root)

    expect(action.payload.routes[0]).not.toHaveProperty(
      'key',
      'index-search-s-0',
    )
    expect(action.payload.routes[0].key).toBeUndefined()
  })

  test('goes to index, not to a record a deep link opened the stack on', () => {
    // `/all/recipes/recipe?id=r1` opened cold: the record is the first route
    // and there is no `index` under it.
    const root = rootWith([
      {
        key: 'all-t',
        name: 'all',
        state: stack('all-s', ['recipes/recipe']),
      },
    ])

    const [action] = groupUnwindActions(root)

    expect(action.payload.routes).toEqual([{ name: 'index' }])
    expect(action.payload.index).toBe(0)
  })

  test('does not reset a stack that declares no index route', () => {
    const root = rootWith([
      {
        key: 'all-t',
        name: 'all',
        state: {
          ...stack('all-s', ['recipes/recipe']),
          routeNames: ['recipes/recipe'],
        },
      },
    ])

    expect(groupUnwindActions(root)).toEqual([])
  })

  test('leaves Settings and Add alone: they are not Group-scoped', () => {
    const root = rootWith([
      {
        key: 'settings-t',
        name: 'settings',
        state: stack('settings-s', ['index', 'appearance']),
      },
      { key: 'add-t', name: 'add' },
    ])

    expect(groupUnwindActions(root)).toEqual([])
  })

  test('skips a tab whose stack has no state yet', () => {
    expect(
      groupUnwindActions(rootWith([{ key: 'all-t', name: 'all' }])),
    ).toEqual([])
  })

  test('does nothing before the tab navigator exists', () => {
    expect(groupUnwindActions(undefined)).toEqual([])
    expect(
      groupUnwindActions({ key: 'root', type: 'stack', routes: [] }),
    ).toEqual([])
  })
})
