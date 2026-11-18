// @vitest-environment jsdom
import { act } from 'react'
import { afterEach, expect, test, vi } from 'vitest'

import { mount } from '../testing/dom'
import { type ModuleArrangement, useModuleArrangement } from './moduleArrangement'

// A store that forgets every write, as an unopenable SQLite store does.
vi.mock('./localPreference', () => ({
  PREFERENCE_KEYS: { allView: 'gather:all:view' },
  allArrangementKey: (slug: string) => `gather:all:${slug}`,
  readPreference: () => null,
  writePreference: () => {},
}))

// A development build: every Module shows. The store build's narrowing is
// `moduleVisibility.test.ts`'s; this suite only needs the hook to apply it.
vi.mock('../modules/buildModules', () => ({ LIVE_MODULES_ONLY: false }))

afterEach(() => {
  document.body.innerHTML = ''
})

function mountTwo(groupSlug: string) {
  const home = { current: undefined as unknown as ModuleArrangement }
  const all = { current: undefined as unknown as ModuleArrangement }
  function Home() {
    home.current = useModuleArrangement(groupSlug)
    return null
  }
  function All() {
    all.current = useModuleArrangement(groupSlug)
    return null
  }
  mount(
    <>
      <Home />
      <All />
    </>,
  )
  return { home, all }
}

test("an Unpin made on one screen reaches the other, even when the store won't keep it", () => {
  const { home, all } = mountTwo('willow')
  // Nothing stored yet, so both start on the default Pins.
  const id = home.current.arrangement.pinned[0]?.id ?? ''
  expect(id).not.toBe('')

  act(() => home.current.togglePinned(id))
  expect(home.current.isPinned(id)).toBe(false)
  expect(all.current.isPinned(id)).toBe(false)

  act(() => all.current.togglePinned(id))
  expect(all.current.isPinned(id)).toBe(true)
  expect(home.current.isPinned(id)).toBe(true)
})
