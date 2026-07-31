import { describe, expect, test } from 'vitest'
import {
  activeNavItemId,
  DOCK_SLOTS,
  dockNavItems,
  getRouteContext,
  navItems,
} from './appNavigation'
import { MODULES } from './modules'
import { DEFAULT_PINS } from './pins'

/**
 * The navigation, tested where it lives: one list, and one answer about which
 * item a route belongs to. The sidebar and the dock render it, so nothing here
 * needs to render anything.
 */

const SLUG = 'jansen-household'

function ids(pins: readonly string[] | undefined, slug: string | null = SLUG) {
  return navItems(pins, slug).map((item) => item.id)
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

  test('keeps every pinned link inside the Group I am standing in', () => {
    for (const item of navItems(['recipes', 'tasks', 'nutrition'], SLUG)) {
      expect(String(item.link.to).startsWith('/g/$groupSlug')).toBe(true)
    }
  })

  test('falls back to a flat destination when no Group is in the URL', () => {
    for (const item of navItems(['recipes'], null)) {
      expect(String(item.link.to).startsWith('/g/')).toBe(false)
    }
  })

  test('marks a Module whose data is only ever mine', () => {
    const items = navItems(['recipes', 'nutrition'], SLUG)
    const personal = items.filter((item) => item.personal).map((i) => i.id)
    expect(personal).toEqual(['nutrition'])
  })

  test('marks a Module that is not built yet', () => {
    const items = navItems(['recipes', 'wines'], SLUG)
    expect(items.find((i) => i.id === 'wines')?.placeholder).toBe(true)
    expect(items.find((i) => i.id === 'recipes')?.placeholder).toBe(false)
  })

  test('can reach every live Module through All, pinned or not', () => {
    const list = navItems([], SLUG)
    expect(list.map((i) => i.id)).toContain('all')
    // Nothing is pinned, so every Module is only reachable via All — which is
    // the page that lists all of them.
    expect(MODULES.length).toBeGreaterThan(list.length)
  })
})

describe('the mobile dock', () => {
  test('shows the whole list when it fits', () => {
    const items = navItems(['recipes', 'tasks'], SLUG)
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
      SLUG,
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
    expect(dockNavItems(navItems([], SLUG)).map((i) => i.id)).toEqual([
      'home',
      'all',
    ])
  })
})

describe('which item is active', () => {
  const pins = ['recipes', 'tasks', 'nutrition']
  const items = navItems(pins, SLUG)

  test('is Home on the Group landing page', () => {
    expect(activeNavItemId(`/g/${SLUG}`, items)).toBe('home')
    expect(activeNavItemId(`/g/${SLUG}/`, items)).toBe('home')
  })

  test('is All on the All page', () => {
    expect(activeNavItemId(`/g/${SLUG}/all`, items)).toBe('all')
  })

  test('is the pinned Module, from its index and from anything under it', () => {
    expect(activeNavItemId(`/g/${SLUG}/recipes`, items)).toBe('recipes')
    expect(activeNavItemId(`/g/${SLUG}/recipes/r1`, items)).toBe('recipes')
    expect(activeNavItemId(`/g/${SLUG}/recipes/r1/edit`, items)).toBe('recipes')
    expect(activeNavItemId(`/g/${SLUG}/nutrition`, items)).toBe('nutrition')
  })

  test('is All inside a Module I have not pinned', () => {
    expect(activeNavItemId(`/g/${SLUG}/baby`, items)).toBe('all')
  })

  test('is nothing on a page the navigation does not describe', () => {
    expect(activeNavItemId('/settings', items)).toBeNull()
    expect(activeNavItemId(`/g/${SLUG}/foods`, items)).toBeNull()
  })

  test('never lights more than one item', () => {
    const paths = [
      `/g/${SLUG}`,
      `/g/${SLUG}/all`,
      `/g/${SLUG}/recipes`,
      `/g/${SLUG}/baby`,
      '/settings',
      '/recipes',
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
      SLUG,
    )
    const paths = [
      `/g/${SLUG}`,
      `/g/${SLUG}/all`,
      `/g/${SLUG}/recipes`,
      `/g/${SLUG}/recipes/r1`,
      `/g/${SLUG}/tasks`,
      `/g/${SLUG}/nutrition`,
      // Pinned fifth, so it is past where the dock runs out of room.
      `/g/${SLUG}/baby`,
      `/g/${SLUG}/foods`,
      '/settings',
      '/dashboard',
      '/recipes',
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
      SLUG,
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

describe('the route context the topbar shows', () => {
  test('names the Group surfaces', () => {
    expect(getRouteContext(`/g/${SLUG}`).title).toBe('Home')
    expect(getRouteContext(`/g/${SLUG}/all`).title).toBe('All modules')
  })

  test('names the Module you are in, in either route tree', () => {
    expect(getRouteContext(`/g/${SLUG}/recipes`)).toMatchObject({
      title: 'Recipes',
      subtitle: 'Keep and rate the dishes you cook.',
    })
    expect(getRouteContext('/recipes/new').title).toBe('Recipes')
  })

  test('names the shell pages', () => {
    expect(getRouteContext('/settings').title).toBe('Settings')
    expect(getRouteContext('/account').title).toBe('Account')
  })

  test('falls back rather than showing an empty header', () => {
    expect(getRouteContext('/nowhere').title).toBe('Gather')
  })
})
