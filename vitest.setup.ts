import '@testing-library/dom'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Node 22+ ships an experimental, inert `globalThis.localStorage` (it throws
// or returns undefined unless run with --localstorage-file). vitest's jsdom
// environment only overrides globals that are absent from the outer Node
// context, so on these Node versions that inert accessor shadows jsdom's own
// working localStorage/sessionStorage implementation. Re-point the globals at
// the real jsdom Storage objects so tests can use window.localStorage as normal.
const jsdomWindow = (globalThis as unknown as { jsdom?: { window?: Window } })
  .jsdom?.window
if (jsdomWindow) {
  Object.defineProperty(globalThis, 'localStorage', {
    get: () => jsdomWindow.localStorage,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    get: () => jsdomWindow.sessionStorage,
    configurable: true,
  })
}

// jsdom deliberately leaves scrolling unimplemented. Components may still
// request it to restore a list position, so make it a harmless browser-like
// no-op instead of printing the same warning for every affected test.
Object.defineProperty(window, 'scrollTo', {
  value: () => undefined,
  writable: true,
  configurable: true,
})

afterEach(() => {
  cleanup()
})
