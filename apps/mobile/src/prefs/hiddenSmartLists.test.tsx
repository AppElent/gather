// @vitest-environment jsdom
import { act } from 'react'
import { afterEach, expect, test, vi } from 'vitest'

import { mount } from '../testing/dom'
import { parseHiddenSmartLists, useHiddenSmartLists } from './hiddenSmartLists'

const stored = new Map<string, string>()
vi.mock('./localPreference', () => ({
  PREFERENCE_KEYS: { hiddenSmartLists: 'gather:tasks:hidden-smart-lists' },
  readPreference: (key: string) => stored.get(key) ?? null,
  writePreference: (key: string, value: string) => stored.set(key, value),
}))

afterEach(() => {
  stored.clear()
  document.body.innerHTML = ''
})

test('an unreadable or unknown value hides nothing it does not know', () => {
  expect(parseHiddenSmartLists(null)).toEqual([])
  expect(parseHiddenSmartLists('not json')).toEqual([])
  expect(parseHiddenSmartLists('{"mine":true}')).toEqual([])
  expect(parseHiddenSmartLists('["mine","someday",3]')).toEqual(['mine'])
})

test('hiding and showing again is kept on the phone', () => {
  const hook = {
    current: undefined as unknown as ReturnType<typeof useHiddenSmartLists>,
  }
  function Probe() {
    hook.current = useHiddenSmartLists()
    return null
  }
  mount(<Probe />)
  expect(hook.current.hidden).toEqual([])

  act(() => hook.current.toggle('unassigned'))
  expect(hook.current.hidden).toEqual(['unassigned'])
  expect(stored.get('gather:tasks:hidden-smart-lists')).toBe('["unassigned"]')

  act(() => hook.current.toggle('unassigned'))
  expect(hook.current.hidden).toEqual([])
  expect(stored.get('gather:tasks:hidden-smart-lists')).toBe('[]')
})
