import { describe, expect, test } from 'vitest'
import {
  BABY_BAR_SHORTCUTS,
  BABY_EVENT_TYPES,
  babyBarSlots,
  declinedEventTypes,
  MEAL_NAMES,
  moveBarSlot,
  NUTRIENT_KEYS,
  offeredEventTypes,
  QUANTITY_UNITS,
  trackedEventTypes,
} from '../domain'
import { fmt, isLocale, plural, resolveLocale } from '../i18n'
import { en, nl } from '../messages'
import { MODULE_GROUPS, MODULES, moduleText } from '../modules'
import { DEFAULT_PINS, pinnedModuleIds } from '../pins'

function leaves(value: unknown, path = ''): Map<string, string> {
  if (typeof value === 'string') return new Map([[path, value]])
  if (typeof value !== 'object' || value === null) return new Map()

  return Object.entries(value).reduce((all, [key, child]) => {
    for (const [childPath, text] of leaves(child, `${path}.${key}`)) {
      all.set(childPath, text)
    }
    return all
  }, new Map<string, string>())
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
}

describe('the portable Gather catalogue', () => {
  test('keeps the complete catalogue and its message join in one contract', () => {
    expect(MODULES).toHaveLength(13)
    expect(MODULE_GROUPS).toEqual(['kitchen', 'money', 'home', 'tasting'])
    expect(moduleText(MODULES[0], en).label).toBe('Recipes')
    expect(moduleText(MODULES[0], nl).label).toBe('Recepten')
  })

  test('normalizes default Pins without a client runtime', () => {
    expect(pinnedModuleIds(undefined)).toEqual(DEFAULT_PINS)
    expect(pinnedModuleIds(['tasks', 'missing', 'tasks'])).toEqual(['tasks'])
  })
})

describe('the portable locale contract', () => {
  test('has matching populated message trees', () => {
    const english = leaves(en)
    const dutch = leaves(nl)

    expect([...dutch.keys()].sort()).toEqual([...english.keys()].sort())
    for (const [path, source] of english) {
      const translation = dutch.get(path)
      expect(source, `${path} must not be empty`).not.toBe('')
      expect(translation, `${path} must not be empty`).not.toBe('')
      expect(placeholders(translation ?? '')).toEqual(placeholders(source))
    }
  })

  test('formats, resolves, and pluralizes Gather locales without Intl', () => {
    expect(fmt('Hello, {name}', { name: 'Eric' })).toBe('Hello, Eric')
    expect(isLocale(['en', 'nl'] as const, 'nl')).toBe(true)
    expect(resolveLocale(['en', 'nl'] as const, 'en', undefined, 'nl-NL')).toBe(
      'nl',
    )
    expect(
      plural('en', 1, { one: '{count} item', other: '{count} items' }),
    ).toBe('1 item')
    expect(
      plural('nl', 2, { one: '{count} item', other: '{count} items' }),
    ).toBe('2 items')
  })
})

test('shares the domain vocabulary outside Convex validators', () => {
  expect(BABY_EVENT_TYPES).toContain('feeding')
  expect(NUTRIENT_KEYS).toContain('protein')
  expect(MEAL_NAMES).toContain('lunch')
  expect(QUANTITY_UNITS).toContain('serving')
})

describe("a Child's tracked types", () => {
  test('an unset field offers every type', () => {
    expect(trackedEventTypes(undefined)).toEqual(BABY_EVENT_TYPES)
  })

  test('an empty array is the same as unset — nothing has been refused', () => {
    expect(trackedEventTypes([])).toEqual(BABY_EVENT_TYPES)
  })

  test('refusing every type offers nothing', () => {
    expect(trackedEventTypes(BABY_EVENT_TYPES)).toEqual([])
  })

  test('what is left is offered, in catalogue order', () => {
    expect(trackedEventTypes(['diaper', 'note'])).toEqual(
      BABY_EVENT_TYPES.filter((type) => type !== 'diaper' && type !== 'note'),
    )
  })

  test('a refusal of a type that no longer exists changes nothing', () => {
    expect(trackedEventTypes(['telepathy' as never])).toEqual(BABY_EVENT_TYPES)
  })

  test('a type added to the catalogue is offered to everyone who never refused it', () => {
    // The whole reason the field holds refusals. A household that said no to
    // diapers years ago has said nothing about Memory, so Memory is offered.
    expect(trackedEventTypes(['diaper'])).toContain('memory')
  })
})

describe('turning an answer into what is stored', () => {
  test('the refusals are everything that was not accepted', () => {
    expect(declinedEventTypes(['feeding', 'diaper'])).toEqual(
      BABY_EVENT_TYPES.filter(
        (type) => type !== 'feeding' && type !== 'diaper',
      ),
    )
  })

  test('it round-trips with what the log offers', () => {
    const chosen = ['feeding', 'sleep', 'memory'] as const
    expect(trackedEventTypes(declinedEventTypes(chosen))).toEqual([...chosen])
  })

  test('accepting everything stores no refusals at all', () => {
    expect(declinedEventTypes(BABY_EVENT_TYPES)).toEqual([])
  })

  test('an unknown acceptance cannot smuggle itself in', () => {
    expect(declinedEventTypes(['telepathy' as never])).toEqual([
      ...BABY_EVENT_TYPES,
    ])
  })
})

describe('the offered types in the household order', () => {
  test('an arrangement is honoured, and its shortcuts are left behind', () => {
    expect(
      offeredEventTypes(declinedEventTypes(['feeding', 'diaper', 'sleep']), [
        'todo',
        'sleep',
        'feeding',
        'question',
        'diaper',
      ]),
    ).toEqual(['sleep', 'feeding', 'diaper'])
  })

  test('with no arrangement it is catalogue order', () => {
    expect(offeredEventTypes(['diaper'], undefined)).toEqual(
      BABY_EVENT_TYPES.filter((type) => type !== 'diaper'),
    )
  })

  test('a newly offered type joins the end rather than going missing', () => {
    expect(
      offeredEventTypes(undefined, ['sleep', 'feeding']).slice(0, 3),
    ).toEqual(['sleep', 'feeding', 'temperature'])
  })
})

describe('rearranging the offer', () => {
  const order = ['feeding', 'diaper', 'sleep'] as const

  test('one place up', () => {
    expect(moveBarSlot(order, 'sleep', -1)).toEqual([
      'feeding',
      'sleep',
      'diaper',
    ])
  })

  test('one place down', () => {
    expect(moveBarSlot(order, 'feeding', 1)).toEqual([
      'diaper',
      'feeding',
      'sleep',
    ])
  })

  test('off the top does nothing rather than wrapping to the bottom', () => {
    expect(moveBarSlot(order, 'feeding', -1)).toEqual([...order])
    expect(moveBarSlot(order, 'sleep', 1)).toEqual([...order])
  })

  test('a type that is not in the list is left alone', () => {
    expect(moveBarSlot(order, 'growth', -1)).toEqual([...order])
  })
})

describe('the log bar', () => {
  test('no stored arrangement is every tracked type, then both shortcuts', () => {
    expect(babyBarSlots(['feeding', 'diaper'], undefined)).toEqual([
      'feeding',
      'diaper',
      ...BABY_BAR_SHORTCUTS,
    ])
  })

  test('a shortcut can sit anywhere, including first', () => {
    expect(
      babyBarSlots(['feeding', 'diaper'], ['question', 'feeding', 'diaper']),
    ).toEqual(['question', 'feeding', 'diaper'])
  })

  test('a shortcut that was taken off stays off', () => {
    expect(babyBarSlots(['feeding'], ['feeding', 'todo'])).toEqual([
      'feeding',
      'todo',
    ])
  })

  test('untracking a type removes its button without rewriting the order', () => {
    expect(
      babyBarSlots(['feeding'], ['todo', 'diaper', 'feeding', 'question']),
    ).toEqual(['todo', 'feeding', 'question'])
  })

  test('a newly tracked type is appended, so you find what you just turned on', () => {
    expect(
      babyBarSlots(['feeding', 'sleep'], ['todo', 'feeding', 'question']),
    ).toEqual(['todo', 'feeding', 'question', 'sleep'])
  })

  test('a duplicate collapses, so nothing gets two buttons', () => {
    expect(babyBarSlots(['feeding'], ['feeding', 'todo', 'feeding'])).toEqual([
      'feeding',
      'todo',
    ])
  })

  test('an empty arrangement is a bar with nothing on it', () => {
    expect(babyBarSlots([], [])).toEqual([])
  })
})
