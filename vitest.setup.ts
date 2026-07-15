import '@testing-library/dom'
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

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

afterEach(() => {
  cleanup()
})
