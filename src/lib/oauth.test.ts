import { beforeEach, describe, expect, test } from 'vitest'
import { consumeOAuthState, newOAuthState } from './oauth'

/**
 * What has to survive leaving the app and coming back.
 *
 * The provider round trip is a full page load, so `sessionStorage` is the only
 * thing that crosses it. A connection belongs to a Group (ADR-0003), which
 * makes the Group as load-bearing as the CSRF state: without it the callback
 * has nowhere to put the token, and the one thing it must not do is pick a
 * Group of its own.
 */

beforeEach(() => {
  sessionStorage.clear()
})

describe('the OAuth round trip', () => {
  test('brings back the provider, the Group and where to return to', () => {
    const state = newOAuthState(
      'notion',
      'jansen-household',
      '/g/jansen-household/tasks',
    )

    expect(consumeOAuthState(state)).toEqual({
      provider: 'notion',
      groupSlug: 'jansen-household',
      returnTo: '/g/jansen-household/tasks',
    })
  })

  test('is refused when the state does not match the one set out with', () => {
    newOAuthState('notion', 'jansen-household', '/settings')

    expect(consumeOAuthState('todoist.someone-elses-state')).toBeNull()
    expect(consumeOAuthState(undefined)).toBeNull()
  })

  test('says it has no Group rather than inventing one', () => {
    // A round trip begun in another tab, or before this key existed, or from a
    // session that has since been cleared: the state matches and the Group is
    // simply not there. The caller has to notice, so it comes back as null.
    const state = newOAuthState('todoist', 'jansen-household', '/settings')
    sessionStorage.removeItem('gather.oauth.groupSlug')

    expect(consumeOAuthState(state)).toEqual({
      provider: 'todoist',
      groupSlug: null,
      returnTo: '/settings',
    })
  })

  test('is good for one trip only', () => {
    const state = newOAuthState('notion', 'jansen-household', '/settings')

    expect(consumeOAuthState(state)).not.toBeNull()
    expect(consumeOAuthState(state)).toBeNull()
  })
})
