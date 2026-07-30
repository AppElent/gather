import { describe, expect, test } from 'vitest'
import { isVisibleToGroups } from './groupAccess'

/**
 * The visibility rule for Group-scoped content, on its own.
 *
 * The rule reads "a Member of the home Group, or of any Group in the shared
 * list", and nothing else — no owner, no creator, no flag on the content. These
 * cases are the rule stated as facts; `recipes.test.ts` proves the real queries
 * apply it.
 */

/** Alice is in the household and the cooking club, and in nothing else. */
const aliceGroups = ['household', 'cooking-club']

describe('isVisibleToGroups', () => {
  test('a Member of the home Group sees it', () => {
    const recipe = { groupId: 'household', sharedGroupIds: [] }
    expect(isVisibleToGroups(recipe, aliceGroups)).toBe(true)
  })

  test('someone in none of its Groups does not', () => {
    const recipe = { groupId: 'wine-club', sharedGroupIds: [] }
    expect(isVisibleToGroups(recipe, aliceGroups)).toBe(false)
  })

  test('a Member of a Group it is shared into sees it', () => {
    const recipe = { groupId: 'wine-club', sharedGroupIds: ['cooking-club'] }
    expect(isVisibleToGroups(recipe, aliceGroups)).toBe(true)
  })

  test('a share into a Group the viewer is not in reveals nothing', () => {
    const recipe = { groupId: 'wine-club', sharedGroupIds: ['book-club'] }
    expect(isVisibleToGroups(recipe, aliceGroups)).toBe(false)
  })

  test('a person in no Groups at all sees nothing', () => {
    const recipe = { groupId: 'household', sharedGroupIds: ['cooking-club'] }
    expect(isVisibleToGroups(recipe, [])).toBe(false)
  })

  // The rule takes no user id, so there is nowhere for "but I created it" to
  // enter it. This is that absence, written down.
  test('the home Group decides, whoever the content came from', () => {
    const recipe = { groupId: 'wine-club', sharedGroupIds: [] }
    expect(isVisibleToGroups(recipe, ['wine-club'])).toBe(true)
    expect(isVisibleToGroups(recipe, aliceGroups)).toBe(false)
  })
})
