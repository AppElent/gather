import { afterEach, expect, test } from 'vitest'

import { draftKey, forgetDrafts, keepDraft, keptDraft } from './composer-drafts'

afterEach(forgetDrafts)

test('a draft is kept per account, Group and place', () => {
  keepDraft(draftKey('u1', 'home', 'tasks:index'), { line: 'Bins' })
  expect(keptDraft(draftKey('u1', 'home', 'tasks:index'))).toEqual({ line: 'Bins' })
  expect(keptDraft(draftKey('u2', 'home', 'tasks:index'))).toBeUndefined()
  expect(keptDraft(draftKey('u1', 'club', 'tasks:index'))).toBeUndefined()
  expect(keptDraft(draftKey('u1', 'home', 'tasks:smart:today'))).toBeUndefined()
})

test('keeping nothing forgets it', () => {
  const key = draftKey('u1', 'home', 'tasks:index')
  keepDraft(key, { line: 'Bins' })
  keepDraft(key, undefined)
  expect(keptDraft(key)).toBeUndefined()
})

test('signed out is its own account', () => {
  expect(draftKey(null, 'home', 'x')).toBe('signed-out:home:x')
})
