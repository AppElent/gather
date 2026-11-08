import { en } from '@gather/core/messages'
import { MODULES } from '@gather/core/modules'
import { DEFAULT_PINS } from '@gather/core/pins'
import { describe, expect, test } from 'vitest'
import {
  activeNavItemId,
  DOCK_SLOTS,
  dockNavItems,
  getRouteContext,
  jumpTargets,
  navItems,
  shellJumpTargets,
} from './appNavigation'

/**
 * The navigation, tested where it lives: one list, and one answer about which
 * item a route belongs to. The sidebar and the dock render it, so nothing here
 * needs to render anything.
 */

function ids(pins: readonly string[] | undefined) {
  return navItems(pins, en).map((item) => item.id)
}

describe('the navigation list', () => {
  test('is Home, then my pins in my order, then All', () => {
    expect(ids(['nutrition', 'recipes'])).toEqual([
      'home',
      'nutrition',
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

  test('marks a Module whose data is only ever mine', () => {
    const items = navItems(['recipes', 'nutrition'], en)
    const personal = items.filter((item) => item.personal).map((i) => i.id)
    expect(personal).toEqual(['nutrition'])
  })

  test('marks a Module that is not built yet', () => {
    const items = navItems(['recipes', 'notes'], en)
    expect(items.find((i) => i.id === 'notes')?.placeholder).toBe(true)
    expect(items.find((i) => i.id === 'recipes')?.placeholder).toBe(false)
  })

  test('can reach every live Module through All, pinned or not', () => {
    const list = navItems([], en)
    expect(list.map((i) => i.id)).toContain('all')
    // Nothing is pinned, so every Module is only reachable via All — which is
    // the page that lists all of them.
    expect(MODULES.length).toBeGreaterThan(list.length)
  })
})

describe('the mobile dock', () => {
  test('shows the whole list when it fits', () => {
    const items = navItems(['recipes', 'tasks'], en)
    expect(dockNavItems(items).map((i) => i.id)).toEqual([
      'home',
      'recipes',
      'tasks',
      'all',
    ])
  })

  test('keeps Home and All at the ends and drops the overflowing pins', () => {
    const items = navItems(
      ['recipes', 'tasks', 'nutrition', 'baby-log', 'wines'],
      en,
    )
    const shown = dockNavItems(items)
    expect(shown).toHaveLength(DOCK_SLOTS)
    expect(shown.map((i) => i.id)).toEqual([
      'home',
      'recipes',
      'tasks',
      'nutrition',
      'all',
    ])
  })

  test('copes with someone who has pinned nothing', () => {
    expect(dockNavItems(navItems([], en)).map((i) => i.id)).toEqual([
      'home',
      'all',
    ])
  })
})

describe('which item is active', () => {
  const pins = ['recipes', 'tasks', 'nutrition']
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
    expect(activeNavItemId('/nutrition', items)).toBe('nutrition')
  })

  test('is All inside a Module I have not pinned', () => {
    expect(activeNavItemId('/baby', items)).toBe('all')
  })

  test('is nothing on a page the navigation does not describe', () => {
    expect(activeNavItemId('/settings', items)).toBeNull()
    expect(activeNavItemId('/foods', items)).toBeNull()
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

  /**
   * The criterion in full. Both surfaces ask `activeNavItemId` about the same
   * full list, so the answer is the same by construction; what has to be shown
   * is that the dock can still display the item they agreed on after cutting
   * the list down.
   */
  test('is an item the dock still shows, however many pins there are', () => {
    const many = navItems(
      ['recipes', 'tasks', 'nutrition', 'baby-log', 'wines'],
      en,
    )
    const paths = [
      '/home',
      '/all',
      '/recipes',
      '/recipes/r1',
      '/tasks',
      '/nutrition',
      // Pinned fifth, so it is past where the dock runs out of room.
      '/baby',
      '/foods',
      '/settings',
    ]
    for (const path of paths) {
      const active = activeNavItemId(path, many)
      const shown = dockNavItems(many, active).map((i) => i.id)
      expect(shown).toHaveLength(DOCK_SLOTS)
      if (active) expect(shown).toContain(active)
    }
  })

  test('keeps the active pin in the dock in place of one that fits', () => {
    const many = navItems(
      ['recipes', 'tasks', 'nutrition', 'baby-log', 'wines'],
      en,
    )
    expect(dockNavItems(many, 'baby-log').map((i) => i.id)).toEqual([
      'home',
      'recipes',
      'tasks',
      'baby-log',
      'all',
    ])
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
