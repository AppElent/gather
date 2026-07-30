import { describe, expect, test } from 'vitest'
import {
  flatRecipeNav,
  groupRecipeNav,
  type RecipeNav,
} from '../components/recipes/recipeNav'
import type { AppLink } from './appLink'

/**
 * The regression this ticket most plausibly causes: a link inside a page that
 * both route trees render, written against the flat path, so following it drops
 * you out of the Group you were in.
 *
 * The pages take every destination as props, so the mistake can only be made in
 * a nav builder — which means it can be caught here, off the built link options,
 * without rendering anything or crawling markup for anchors.
 */

const SLUG = 'jansen-household'

/** Every destination a nav can produce, ids filled in with something visible. */
function destinationsOf(nav: RecipeNav): AppLink[] {
  return [nav.list, nav.create, nav.detail('r1'), nav.edit('r1')]
}

function paramsOf(link: AppLink): Record<string, unknown> {
  return typeof link.params === 'object' && link.params !== null
    ? link.params
    : {}
}

describe('links built for a Group', () => {
  test('every Recipes destination carries the Group', () => {
    for (const link of destinationsOf(groupRecipeNav(SLUG))) {
      expect(String(link.to).startsWith('/g/$groupSlug/')).toBe(true)
      expect(paramsOf(link).groupSlug).toBe(SLUG)
    }
  })

  test('a record id still reaches the destination alongside the Group', () => {
    const nav = groupRecipeNav(SLUG)
    expect(paramsOf(nav.detail('r1')).recipeId).toBe('r1')
    expect(paramsOf(nav.edit('r1')).recipeId).toBe('r1')
  })
})

describe('links built outside any Group', () => {
  test('every Recipes destination stays on the flat route', () => {
    for (const link of destinationsOf(flatRecipeNav)) {
      expect(String(link.to).startsWith('/recipes')).toBe(true)
      expect(paramsOf(link).groupSlug).toBeUndefined()
    }
  })
})
