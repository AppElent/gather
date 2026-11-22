import { afterEach, expect, test } from 'vitest'

import {
  draftKey,
  forgetDrafts,
  holdDraft,
  keepDraft,
  keptDraft,
  pendingSave,
} from './composer-drafts'

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

test('a draft being saved is held until the save settles, then released', async () => {
  const key = draftKey('u1', 'g1', 'tasks:index')
  let land: (saved: boolean) => void = () => {}
  const saving = new Promise<boolean>((resolve) => {
    land = resolve
  })
  holdDraft(key, saving)
  expect(pendingSave(key)).toBe(saving)
  expect(pendingSave(draftKey('u1', 'g1', 'tasks:smart:today'))).toBeUndefined()
  land(true)
  await expect(saving).resolves.toBe(true)
  await Promise.resolve()
  expect(pendingSave(key)).toBeUndefined()
})

test('an older save settling does not release a newer hold', async () => {
  const key = draftKey('u1', 'g1', 'tasks:index')
  let first: (saved: boolean) => void = () => {}
  const older = new Promise<boolean>((resolve) => {
    first = resolve
  })
  const newer = new Promise<boolean>(() => {})
  holdDraft(key, older)
  holdDraft(key, newer)
  first(false)
  await older
  await Promise.resolve()
  expect(pendingSave(key)).toBe(newer)
})
