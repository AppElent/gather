/**
 * Rendering for the few mobile tests that need React itself — an effect, a
 * boundary, a provider — rather than a pure function.
 *
 * The mobile suite runs in Node with no React Native renderer, so a test that
 * renders opts into jsdom (`// @vitest-environment jsdom`) and mounts
 * components that do not touch React Native, through the app's own
 * `react-dom`, which is pinned to the same React as the app. React Native
 * modules a component imports are mocked by the test.
 */
import { act, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

export function mount(element: ReactElement) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(element))
  return {
    container,
    rerender: (next: ReactElement) => act(() => root.render(next)),
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

/** Let pending promises and effects settle inside `act`. */
export async function settle(ms = 0) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })
}

/** Settle repeatedly until `check` passes, or fail after `timeoutMs`. */
export async function until(check: () => boolean, timeoutMs = 2_000) {
  const started = Date.now()
  while (!check()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('condition not met in time')
    }
    await settle(10)
  }
}
