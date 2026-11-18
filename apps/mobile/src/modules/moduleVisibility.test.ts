/// <reference types="vite/client" />
import { arrangeModules } from '@gather/core/module-arrangement'
import { MODULES as LITERAL_MODULES, type ModuleDef } from '@gather/core/modules'
import { describe, expect, test, vi } from 'vitest'

import { targetsForDrop } from '../drop/dropTargets'
import { recordShown, searchableTypes } from '../search/searchResults'
import { QUICK_ACTIONS } from '../shell/quickActions'
import {
  isModuleShown,
  isRouteShown,
  shownArrangement,
  showsOnlyLiveModules,
} from './moduleVisibility'

/**
 * Every Module is live on the phone today (APP-374), so the store build hides
 * nothing and the real catalogue cannot exercise the gate. These tests run it
 * against a catalogue where three Modules are not built on the phone yet; the
 * real catalogue's answer is checked in `storeModules.test.ts`.
 */
const NOT_ON_THE_PHONE = vi.hoisted(() => ['notes', 'calendar', 'pantry'])

vi.mock('@gather/core/modules', async (importOriginal) => {
  const real = await importOriginal<typeof import('@gather/core/modules')>()
  const MODULES = real.MODULES.map((module) =>
    NOT_ON_THE_PHONE.includes(module.id)
      ? { ...module, mobileStatus: 'placeholder' as const }
      : module,
  )
  return {
    ...real,
    MODULES,
    moduleById: (id: string) => MODULES.find((module) => module.id === id),
  }
})

/** Widened: in the real catalogue every `mobileStatus` is the literal `live`. */
const MODULES: readonly ModuleDef[] = LITERAL_MODULES

const LIVE: readonly string[] = MODULES.filter(
  (module) => module.mobileStatus === 'live',
).map((module) => module.id)
const PLACEHOLDER: readonly string[] = MODULES.filter(
  (module) => module.mobileStatus === 'placeholder',
).map((module) => module.id)

const store = (id: string) => isModuleShown(id, true)
const development = (id: string) => isModuleShown(id, false)

/** Every route file under the Group-scoped tabs, as the stack names it. */
const TAB_ROUTES = Object.keys(import.meta.glob('../../app/**/*.tsx'))
  .map((file) =>
    file.match(/^\.\.\/\.\.\/app\/\(app\)\/\(tabs\)\/(home|all|search)\/(.+)\.tsx$/),
  )
  .flatMap((match) => (match?.[2] ? [match[2]] : []))
  .filter((name) => !name.endsWith('_layout'))

describe('which build shows only live Modules', () => {
  test('the store build does, development and preview do not', () => {
    expect(showsOnlyLiveModules('com.appelent.gather')).toBe(true)
    expect(showsOnlyLiveModules('com.appelent.gather.preview')).toBe(false)
    expect(showsOnlyLiveModules('com.appelent.gather.dev')).toBe(false)
  })

  test('a build that cannot say which it is hides, rather than risks a review', () => {
    expect(showsOnlyLiveModules(undefined)).toBe(true)
    expect(showsOnlyLiveModules('com.example.other')).toBe(true)
  })

  test('the screenshot override can only hide', () => {
    expect(showsOnlyLiveModules('com.appelent.gather.dev', '1')).toBe(true)
    expect(showsOnlyLiveModules('com.appelent.gather', '0')).toBe(true)
  })
})

describe('the store build', () => {
  test('there is something to hide, and something left', () => {
    expect(LIVE.length).toBeGreaterThan(0)
    expect([...PLACEHOLDER].sort()).toEqual([...NOT_ON_THE_PHONE].sort())
  })

  test.each(
    MODULES.map((module) => [module.id, module.mobileStatus] as const),
  )('%s (%s on the phone) shows only when live there', (id, mobileStatus) => {
    expect(store(id)).toBe(mobileStatus === 'live')
    expect(development(id)).toBe(true)
  })

  test("the web's status does not decide what the phone shows", () => {
    const webOnly = MODULES.filter(
      (module) =>
        module.status === 'placeholder' && module.mobileStatus === 'live',
    )
    expect(webOnly.length).toBeGreaterThan(0)
    for (const module of webOnly) expect(store(module.id)).toBe(true)
  })

  test('an unknown Module shows in no build', () => {
    expect(isModuleShown('nutrition', false)).toBe(false)
    expect(isModuleShown('nutrition', true)).toBe(false)
  })

  test("All and Home's pins hold only live Modules, even pinned or reordered ones", () => {
    const arrangement = shownArrangement(
      arrangeModules({
        pinned: ['notes', 'recipes', 'calendar'],
        hidden: ['pantry', 'beers'],
        order: ['groceries', 'tasks'],
      }),
      true,
    )
    const ids = [
      ...arrangement.pinned,
      ...arrangement.groups.flatMap((group) => group.modules),
      ...arrangement.hidden,
    ].map((module) => module.id)
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) expect(LIVE).toContain(id)
    expect(arrangement.pinned.map((module) => module.id)).toEqual(['recipes'])
    expect(arrangement.hidden.map((module) => module.id)).toEqual(['beers'])
    // A category with nothing left in it is not drawn at all.
    for (const group of arrangement.groups) {
      expect(group.modules.length).toBeGreaterThan(0)
    }
  })

  test('development keeps the arrangement as it is', () => {
    const arrangement = arrangeModules({ pinned: ['notes'] })
    expect(shownArrangement(arrangement, false)).toBe(arrangement)
  })

  test('no route of a hidden Module draws, in Home, All or Search', () => {
    expect(TAB_ROUTES).toContain('notes/[noteId]')
    for (const name of TAB_ROUTES) {
      const segment = name.split('/')[0] ?? ''
      const hidden = PLACEHOLDER.includes(segment)
      expect(isRouteShown(name, true), name).toBe(!hidden)
      expect(isRouteShown(name, false), name).toBe(true)
    }
    // Not a Module's own route: the tab roots, the placeholder route (which
    // answers for itself) and the tasting Kinds.
    expect(isRouteShown('index', true)).toBe(true)
    expect(isRouteShown('[moduleId]', true)).toBe(true)
    expect(isRouteShown('tasting/[kind]/subject', true)).toBe(true)
  })

  test('the quick-actions sheet offers only verbs of live Modules', () => {
    const shown = QUICK_ACTIONS.filter((action) => store(action.module))
    expect(shown.length).toBeGreaterThan(0)
    for (const action of shown) expect(LIVE).toContain(action.module)
  })

  test('a Drop is never aimed at a hidden Module, and one target is still preselected', () => {
    for (const kind of ['url', 'text', 'image'] as const) {
      const targets = targetsForDrop({ kind, shown: store })
      expect(targets.length, kind).toBeGreaterThan(0)
      for (const target of targets) expect(LIVE).toContain(target.module)
      expect(targets.filter((target) => target.preselected)).toHaveLength(1)
    }
    // Text is a note by default; in the store build it is a task.
    expect(targetsForDrop({ kind: 'text', shown: store })[0]?.id).toBe(
      'task-new',
    )
    expect(targetsForDrop({ kind: 'text', shown: development })[0]?.id).toBe(
      'note-new',
    )
  })

  test('Search finds and remembers only records of live Modules', () => {
    expect(searchableTypes(store)).not.toContain('note')
    expect(searchableTypes(store)).not.toContain('calendarEvent')
    expect(searchableTypes(store)).toEqual(
      expect.arrayContaining(['recipe', 'task', 'tasting', 'loyaltyCard']),
    )
    expect(searchableTypes(development)).toContain('note')

    expect(recordShown({ type: 'note' }, store)).toBe(false)
    expect(recordShown({ type: 'calendarEvent' }, store)).toBe(false)
    expect(recordShown({ type: 'recipe' }, store)).toBe(true)
    expect(recordShown({ type: 'tasting', kind: 'wine' }, store)).toBe(true)
    // A tasting without a Kind has no Module, and no address either.
    expect(recordShown({ type: 'tasting' }, store)).toBe(false)
  })
})
