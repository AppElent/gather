/**
 * The one seam this feature is unit-tested at.
 *
 * Given a Drop — a payload kind and, for a link, its host — the chooser shows
 * an ordered list of destinations with one already selected. That list is the
 * highest point at which the feature is a value rather than a screen, and it is
 * the behaviour people actually notice, so it is the behaviour under test.
 *
 * Everything here asserts what the sheet would *show*, never how the ranking is
 * computed. The host table in `@gather/core/drop-rules` is covered through this
 * function rather than by a test of its own; it earns one when the web importer
 * becomes its second consumer.
 */

import { DROP_KINDS } from '@gather/core/drop-rules'
import { MODULES } from '@gather/core/modules'
import { describe, expect, test } from 'vitest'

import { DROP_TARGETS, dropTargetById, targetsForDrop } from './dropTargets'

const idsFor = (kind: 'url' | 'text' | 'image', host?: string) =>
  targetsForDrop({ kind, host }).map((target) => target.id)

const selected = (kind: 'url' | 'text' | 'image', host?: string) =>
  targetsForDrop({ kind, host }).find((target) => target.preselected)?.id

describe('what a Drop can become', () => {
  test('a link offers a recipe, a note, a task and a grocery line', () => {
    expect(idsFor('url')).toEqual([
      'recipe-import',
      'note-new',
      'note-append',
      'task-new',
      'grocery-line',
    ])
  })

  test('text offers the same without the recipe importer', () => {
    expect(idsFor('text')).toEqual([
      'note-new',
      'note-append',
      'task-new',
      'grocery-line',
    ])
  })

  test('a photo offers the four places a picture belongs', () => {
    expect(idsFor('image')).toEqual([
      'baby-memory',
      'recipe-new-photo',
      'recipe-photo',
      'cheese-photo',
      'wine-photo',
      'beer-photo',
    ])
  })

  test('every payload kind offers somewhere to go', () => {
    for (const kind of DROP_KINDS) {
      expect(targetsForDrop({ kind }), kind).not.toHaveLength(0)
    }
  })
})

describe('which destination is on top', () => {
  test('a link with no rule about it is a recipe', () => {
    expect(selected('url', 'example.com')).toBe('recipe-import')
  })

  test('a link Gather cannot even parse a host out of is still a recipe', () => {
    expect(selected('url')).toBe('recipe-import')
    expect(selected('url', '')).toBe('recipe-import')
  })

  test('text is a note', () => {
    expect(selected('text')).toBe('note-new')
  })

  test('a photo is a baby memory', () => {
    expect(selected('image')).toBe('baby-memory')
  })

  test('a video host is a note instead', () => {
    expect(selected('url', 'youtube.com')).toBe('note-new')
    expect(selected('url', 'm.youtube.com')).toBe('note-new')
  })

  /**
   * The never-restrict guarantee, asserted directly because it is the rule a
   * later change is most likely to break quietly. A rule about a website must
   * never become a rule about a person: the cooking video whose description
   * really does hold a recipe still has Recipes one tap away.
   */
  test('and a video host still offers the recipe importer', () => {
    expect(idsFor('url', 'youtube.com')).toEqual(idsFor('url'))
  })

  test('a known recipe site is a recipe', () => {
    expect(selected('url', 'leukerecepten.nl')).toBe('recipe-import')
    expect(selected('url', 'www.leukerecepten.nl')).toBe('recipe-import')
  })

  test('a host rule never applies to a payload that is not a link', () => {
    expect(idsFor('image', 'youtube.com')).toEqual(idsFor('image'))
    expect(selected('text', 'youtube.com')).toBe('note-new')
  })

  test('exactly one destination is preselected, always', () => {
    for (const kind of DROP_KINDS) {
      const chosen = targetsForDrop({ kind, host: 'youtube.com' }).filter(
        (target) => target.preselected,
      )
      expect(chosen, kind).toHaveLength(1)
    }
  })
})

describe('the registry itself', () => {
  /**
   * The compile-time guarantee restated at runtime, so that a cast cannot
   * defeat it. A Module that accepts nothing says so with an empty list; adding
   * a Module without answering the question does not typecheck.
   */
  test('every Module has answered what Drops it accepts', () => {
    expect(Object.keys(DROP_TARGETS).sort()).toEqual(
      MODULES.map((module) => module.id).sort(),
    )
  })

  test('a Module that takes nothing declares an empty list', () => {
    expect(DROP_TARGETS.finances).toEqual([])
    expect(DROP_TARGETS.pantry).toEqual([])
  })

  test('every registered target is reachable from some payload kind', () => {
    const reachable = new Set(
      DROP_KINDS.flatMap((kind) =>
        targetsForDrop({ kind }).map((target) => target.id),
      ),
    )
    for (const targets of Object.values(DROP_TARGETS)) {
      for (const target of targets) {
        expect(reachable, target.id).toContain(target.id)
      }
    }
  })

  test('every target resolves to a screen', () => {
    for (const targets of Object.values(DROP_TARGETS)) {
      for (const target of targets) {
        expect(target.route({ id: 'seed' }), target.id).toBeTruthy()
      }
    }
  })

  /**
   * Appending needs a second stage — which note, which list, which cheese —
   * and creating does not. The chooser reads this to decide whether confirming
   * finishes the Drop or asks one more question.
   */
  test('a target that appends says what stage two picks', () => {
    for (const targets of Object.values(DROP_TARGETS)) {
      for (const target of targets) {
        if (target.picks === 'none') continue
        expect(target.id).not.toBe('')
      }
    }
    expect(dropTargetById('note-append').picks).toBe('note')
    expect(dropTargetById('note-new').picks).toBe('none')
    expect(dropTargetById('task-new').picks).toBe('task-list')
    expect(dropTargetById('recipe-photo').picks).toBe('recipe')
    expect(dropTargetById('cheese-photo').picks).toBe('tasting-subject')
  })

  /**
   * The Group already names its grocery list, so a grocery Drop is the one
   * append that asks nothing — the shortest path in the whole flow.
   */
  test('a grocery line asks nothing extra', () => {
    expect(dropTargetById('grocery-line').picks).toBe('none')
  })
})
