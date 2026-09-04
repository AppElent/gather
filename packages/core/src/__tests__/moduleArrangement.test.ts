import { describe, expect, test } from 'vitest'
import {
  arrangeModules,
  flattenModuleOrder,
  reconcileOrder,
  toggleHidden,
} from '../moduleArrangement'
import { MODULE_GROUPS, MODULES } from '../modules'
import { DEFAULT_PINS } from '../pins'

const ids = (modules: { id: string }[]) => modules.map((module) => module.id)
const kitchenOf = (stored: Parameters<typeof arrangeModules>[0]) =>
  ids(
    arrangeModules(stored).groups.find((group) => group.group === 'kitchen')
      ?.modules ?? [],
  )

describe('an arrangement nobody has touched', () => {
  test('is the catalogue, in the order the catalogue declares', () => {
    const arrangement = arrangeModules()
    expect(arrangement.groups.map((group) => group.group)).toEqual([
      ...MODULE_GROUPS,
    ])
    expect(kitchenOf({})).toEqual([
      'recipes',
      'nutrition',
      'meal-planner',
      'groceries',
      'pantry',
    ])
    expect(arrangement.hidden).toEqual([])
    expect(ids(arrangement.pinned)).toEqual([...DEFAULT_PINS])
  })
})

describe('a Module that ships after somebody arranged their screen', () => {
  test('appears, because hiding stores refusals rather than acceptances', () => {
    // Every Module refused but one. A newcomer is in nobody's refusals, so it
    // arrives visible — the whole reason `hidden` is stored this way round.
    const hidden = MODULES.map((module) => module.id).filter(
      (id) => id !== 'recipes',
    )
    const arrangement = arrangeModules({ hidden })
    expect(kitchenOf({ hidden })).toEqual(['recipes'])
    expect(arrangement.hidden).toHaveLength(MODULES.length - 1)
  })

  test('lands at its canonical position in its section, not at the bottom', () => {
    // 'pantry' is last in the catalogue's kitchen list and unmentioned here, so
    // a naive append would put it last anyway. 'meal-planner' is the real test:
    // it is unmentioned and canonically third, and it must land after
    // 'nutrition' rather than being swept to the end.
    expect(
      kitchenOf({ order: ['pantry', 'recipes', 'nutrition', 'groceries'] }),
    ).toEqual(['pantry', 'recipes', 'nutrition', 'meal-planner', 'groceries'])
  })

  test('lands at the front when nothing canonically precedes it', () => {
    expect(kitchenOf({ order: ['nutrition', 'meal-planner'] })).toEqual([
      'recipes',
      'nutrition',
      'meal-planner',
      'groceries',
      'pantry',
    ])
  })
})

describe('a group order', () => {
  test('is honoured, and an unmentioned group follows its canonical predecessor', () => {
    // Not ['home', 'money', 'kitchen', 'tasting']: money canonically follows
    // kitchen, and nothing unmentioned may split the two the reader placed.
    expect(
      arrangeModules({ groupOrder: ['home', 'kitchen'] }).groups.map(
        (group) => group.group,
      ),
    ).toEqual(['home', 'kitchen', 'money', 'tasting'])
  })
})

describe('what a stored order may contain', () => {
  test('drops an id that no longer names a Module', () => {
    expect(kitchenOf({ order: ['sourdough', 'nutrition', 'recipes'] })).toEqual(
      ['nutrition', 'recipes', 'meal-planner', 'groceries', 'pantry'],
    )
  })

  test('drops a hidden id that no longer names a Module', () => {
    expect(arrangeModules({ hidden: ['sourdough'] }).hidden).toEqual([])
  })

  test('keeps a duplicated id once', () => {
    expect(kitchenOf({ order: ['pantry', 'pantry', 'recipes'] })).toEqual([
      'pantry',
      'recipes',
      'nutrition',
      'meal-planner',
      'groceries',
    ])
  })
})

describe('pins', () => {
  test('fall back to the default before anybody has chosen', () => {
    expect(ids(arrangeModules({}).pinned)).toEqual([...DEFAULT_PINS])
  })

  test('honour an empty list as a real choice to pin nothing', () => {
    expect(arrangeModules({ pinned: [] }).pinned).toEqual([])
  })

  test('lose a Module that is hidden, because a shortcut to it is a contradiction', () => {
    const arrangement = arrangeModules({
      pinned: ['recipes', 'tasks'],
      hidden: ['recipes'],
    })
    expect(ids(arrangement.pinned)).toEqual(['tasks'])
    expect(ids(arrangement.hidden)).toEqual(['recipes'])
  })

  test('keep a Module in its own section as well as at the top', () => {
    expect(kitchenOf({ pinned: ['recipes'] })).toContain('recipes')
  })
})

describe('writing an arrangement back', () => {
  test('flattens to a full order when nothing is hidden', () => {
    const arrangement = arrangeModules({ groupOrder: ['home', 'kitchen'] })
    expect(flattenModuleOrder(arrangement.groups)).toHaveLength(MODULES.length)
  })

  test('drops hidden Modules, so unhiding restores their canonical position', () => {
    const hidden = ['nutrition']
    const flat = flattenModuleOrder(arrangeModules({ hidden }).groups)
    expect(flat).not.toContain('nutrition')
    // Read back with the refusal lifted: 'nutrition' returns to slot two.
    expect(kitchenOf({ order: flat })).toEqual([
      'recipes',
      'nutrition',
      'meal-planner',
      'groceries',
      'pantry',
    ])
  })

  test('round-trips a rearrangement unchanged', () => {
    const order = [
      'pantry',
      'recipes',
      'nutrition',
      'meal-planner',
      'groceries',
    ]
    const once = kitchenOf({ order })
    expect(
      kitchenOf({
        order: flattenModuleOrder(arrangeModules({ order }).groups),
      }),
    ).toEqual(once)
  })
})

describe('toggleHidden', () => {
  test('adds and removes', () => {
    expect(toggleHidden([], 'wines')).toEqual(['wines'])
    expect(toggleHidden(['wines', 'beers'], 'wines')).toEqual(['beers'])
  })
})

describe('reconcileOrder', () => {
  test('returns the stored order untouched when it is already complete', () => {
    expect(reconcileOrder(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual([
      'c',
      'a',
      'b',
    ])
  })

  test('is the canonical order when nothing is stored', () => {
    expect(reconcileOrder(['a', 'b', 'c'], undefined)).toEqual(['a', 'b', 'c'])
    expect(reconcileOrder(['a', 'b', 'c'], [])).toEqual(['a', 'b', 'c'])
  })
})
