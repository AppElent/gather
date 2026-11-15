// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest'

import { mount, settle } from '../../../testing/dom'
import { useKeepAwakeWhile } from './use-keep-awake-while'

const state = vi.hoisted(() => ({ calls: [] as string[] }))

vi.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: async (tag: string) => {
    state.calls.push(`on ${tag}`)
  },
  deactivateKeepAwake: async (tag: string) => {
    state.calls.push(`off ${tag}`)
  },
}))

function Till({ shown }: { shown: boolean }) {
  useKeepAwakeWhile(shown)
  return null
}

beforeEach(() => {
  state.calls = []
})

test('stays awake only while the card is on screen, though still mounted', async () => {
  const view = mount(<Till shown />)
  await settle()
  expect(state.calls).toEqual(['on loyalty-card-till'])

  // Another tab, or Edit pushed on top: mounted, but no longer shown.
  view.rerender(<Till shown={false} />)
  await settle()
  expect(state.calls).toEqual(['on loyalty-card-till', 'off loyalty-card-till'])

  view.rerender(<Till shown />)
  view.unmount()
  await settle()
  expect(state.calls).toEqual([
    'on loyalty-card-till',
    'off loyalty-card-till',
    'on loyalty-card-till',
    'off loyalty-card-till',
  ])
})
