import { en } from '@gather/core/messages'
import { MODULES } from '@gather/core/modules'
import { DEFAULT_PINS } from '@gather/core/pins'
import { describe, expect, test } from 'vitest'
import {
  activeNavItemId,
  activeTab,
  getRouteContext,
  getRouteGroup,
  jumpTargets,
  navItems,
  shellJumpTargets,
} from './appNavigation'

/**
 * The navigation, tested where it lives: one list, and one answer about which
 * item a route belongs to. The sidebar and the tab bar render it, so nothing
 * here needs to render anything.
 */

function ids(pins: readonly string[] | undefined) {
  return navItems(pins, en).map((item) => item.id)
}

describe('the navigation list', () => {
  test('is Home, then my pins in my order, then All', () => {
    expect(ids(['meal-planner', 'recipes'])).toEqual([
      'home',
      'meal-planner',
      'recipes',
      'all',
    ])
  })

  test('starts a person who has never pinned on the default', () => {
    expect(ids(undefined)).toEqual(['home', ...DEFAULT_PINS, 'all'])
  })

  test('is still Home and All for someone who has pinned nothing', () => {
    expect(ids([])).toEqual(['home', 'all'])
  })

  test('ignores a pin no Module declares rather than breaking', () => {
    expect(ids(['recipes', 'seances'])).toEqual(['home', 'recipes', 'all'])
  })

  test('marks a Module that is not built yet', () => {
    const items = navItems(['recipes', 'notes'], en)
    expect(items.find((i) => i.id === 'notes')?.placeholder).toBe(true)
    expect(items.find((i) => i.id === 'recipes')?.placeholder).toBe(false)
  })
})

describe('the phone-width tab bar', () => {
  test('lights Start on Start and Settings on your Settings', () => {
    expect(activeTab('/home')).toBe('home')
    expect(activeTab('/settings')).toBe('settings')
  })

  test('puts every Module page under All, pinned or not, as the phone does', () => {
    expect(activeTab('/all')).toBe('all')
    expect(activeTab('/tasks')).toBe('all')
    expect(activeTab('/recipes/r1/edit')).toBe('all')
    expect(activeTab('/baby')).toBe('all')
  })

  test('lights nothing on a page that is no tab', () => {
    expect(activeTab('/groups')).toBeNull()
    expect(activeTab('/account')).toBeNull()
    expect(activeTab('/group-settings')).toBeNull()
  })
})

describe('which item is active', () => {
  const pins = ['recipes', 'tasks', 'meal-planner']
  const items = navItems(pins, en)

  test('is Home on the Group landing page', () => {
    expect(activeNavItemId('/home', items)).toBe('home')
  })

  test('is All on the All page', () => {
    expect(activeNavItemId('/all', items)).toBe('all')
  })

  test('is the pinned Module, from its index and from anything under it', () => {
    expect(activeNavItemId('/recipes', items)).toBe('recipes')
    expect(activeNavItemId('/recipes/r1', items)).toBe('recipes')
    expect(activeNavItemId('/recipes/r1/edit', items)).toBe('recipes')
    expect(activeNavItemId('/meal-planner', items)).toBe('meal-planner')
  })

  test('is All inside a Module I have not pinned', () => {
    expect(activeNavItemId('/baby', items)).toBe('all')
  })

  test('is nothing on a page the navigation does not describe', () => {
    expect(activeNavItemId('/settings', items)).toBeNull()
    expect(activeNavItemId('/account', items)).toBeNull()
  })

  test('never lights more than one item', () => {
    const paths = [
      '/home',
      '/all',
      '/recipes',
      '/baby',
      '/settings',
    ]
    for (const path of paths) {
      const active = activeNavItemId(path, items)
      const matches = items.filter((item) => item.id === active)
      expect(matches.length).toBeLessThanOrEqual(1)
    }
  })

  // The bug this rewrite exists to kill: "Tasks" appeared in two blocks with
  // two destinations, so one of them silently left the Group.
  test('gives one destination per label, whichever surface renders it', () => {
    const labels = items.map((i) => i.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  test('carries the Module’s group for its tile, and none for Home and All', () => {
    expect(items.find((i) => i.id === 'recipes')?.group).toBe('kitchen')
    expect(items.find((i) => i.id === 'tasks')?.group).toBe('home')
    expect(items.find((i) => i.id === 'home')?.group).toBeUndefined()
    expect(items.find((i) => i.id === 'all')?.group).toBeUndefined()
  })
})

describe('where the jump-to palette can send you', () => {
  function labels() {
    return jumpTargets(en).map((t) => t.label)
  }

  test('starts at Home and offers All, whatever you have pinned', () => {
    expect(labels()[0]).toBe('Home')
    expect(labels()).toContain('All')
  })

  test('offers every Module, not only the pinned ones', () => {
    const offered = jumpTargets(en).map((t) => t.id)
    for (const module of MODULES) expect(offered).toContain(module.id)
  })

  test('sends Home and All to the same places the sidebar does', () => {
    const nav = navItems([], en)
    const jump = jumpTargets(en)
    for (const id of ['home', 'all']) {
      expect(jump.find((t) => t.id === id)?.link).toEqual(
        nav.find((i) => i.id === id)?.link,
      )
    }
  })

  // Outside a Group only the pages that exist outside one are offered. Anything
  // else would have to pick a Group on the reader's behalf.
  test('offers only the pages that exist without a Group, outside one', () => {
    expect(shellJumpTargets(en).map((t) => t.id)).toEqual([
      'settings',
      'groups',
    ])
  })

  test('names each destination once', () => {
    expect(new Set(labels()).size).toBe(labels().length)
  })

  // A Group's settings and your own are two pages, and the palette is where
  // they are most easily confused: both would otherwise be one word.
  test('offers this Group’s settings, apart from your own', () => {
    const settings = jumpTargets(en).filter((t) =>
      t.label.toLowerCase().includes('settings'),
    )
    expect(settings.map((t) => t.label)).toEqual(['Group settings', 'Settings'])
    expect(settings[0].link.params).toEqual({})
    expect(settings[1].link.to).toBe('/settings')
  })

  test('offers no Group settings when you are standing in no Group', () => {
    expect(shellJumpTargets(en).map((t) => t.label)).not.toContain(
      'Group settings',
    )
  })
})

describe('the route context the topbar shows', () => {
  test('names the Group surfaces', () => {
    expect(getRouteContext('/home', en).title).toBe('Home')
    expect(getRouteContext('/all', en).title).toBe('All modules')
  })

  test('names the Module you are in, from anywhere inside it', () => {
    expect(getRouteContext('/recipes', en)).toMatchObject({
      title: 'Recipes',
      subtitle: 'Keep and rate the dishes you cook.',
    })
    expect(getRouteContext('/recipes/new', en).title).toBe('Recipes')
    expect(getRouteContext('/recipes/r1/edit', en).title).toBe('Recipes')
  })

  test('names the shell pages', () => {
    expect(getRouteContext('/settings', en).title).toBe('Settings')
    expect(getRouteContext('/account', en).title).toBe('Account')
  })

  test('falls back rather than showing an empty header', () => {
    expect(getRouteContext('/nowhere', en).title).toBe('Gather')
  })
})

describe('the group a page wears', () => {
  test("is the Module's, from anywhere inside it", () => {
    expect(getRouteGroup('/recipes')).toBe('kitchen')
    expect(getRouteGroup('/recipes/r1/edit')).toBe('kitchen')
    expect(getRouteGroup('/tasks')).toBe('home')
  })

  test('is none on the shell pages', () => {
    for (const path of ['/', '/home', '/all', '/settings', '/account', '/nowhere'])
      expect(getRouteGroup(path), path).toBeUndefined()
  })
})
