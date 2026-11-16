// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'

import type { AvailabilityMode } from '../../../availability/state'
import { mount } from '../../../testing/dom'

const copy = vi.hoisted(() => ({ byAccount: new Map<string, unknown[]>() }))
vi.mock('./offline-cards', () => ({
  offlineCards: (account: string | null | undefined) =>
    (account && copy.byAccount.get(account)) || [],
}))

const { useOfflineCards } = await import('./use-offline-cards')

const card = { _id: 'k1', storeName: 'HEMA', cardNumber: '1', barcodeFormat: 'QR' }

function harness(mode: AvailabilityMode, account: string | null) {
  const result = { current: undefined as unknown as ReturnType<typeof useOfflineCards> }
  function Probe(props: { mode: AvailabilityMode; account: string | null }) {
    result.current = useOfflineCards(props.mode, props.account)
    return null
  }
  const view = mount(<Probe mode={mode} account={account} />)
  return {
    result,
    to: (next: AvailabilityMode, who: string | null = account) =>
      view.rerender(<Probe mode={next} account={who} />),
  }
}

afterEach(() => {
  copy.byAccount.clear()
  document.body.innerHTML = ''
})

test('a cold start behind the splash draws nothing', () => {
  copy.byAccount.set('user_a', [card])
  const { result } = harness('splash', 'user_a')
  expect(result.current).toEqual({ cards: [], retrying: false })
})

test('unavailable draws the copy; Try again keeps it through the splash', () => {
  copy.byAccount.set('user_a', [card])
  const { result, to } = harness('unavailable', 'user_a')
  expect(result.current).toEqual({ cards: [card], retrying: false })
  to('splash')
  expect(result.current).toEqual({ cards: [card], retrying: true })
  to('connected')
  expect(result.current.cards).toEqual([])
  to('splash')
  expect(result.current.cards).toEqual([])
})

test('a copy that reads empty again is not kept from before', () => {
  copy.byAccount.set('user_a', [card])
  const { result, to } = harness('unavailable', 'user_a')
  copy.byAccount.clear()
  to('splash')
  to('unavailable')
  expect(result.current.cards).toEqual([])
})

test('another account, or none, never sees the cards held for the last', () => {
  copy.byAccount.set('user_a', [card])
  const { result, to } = harness('unavailable', 'user_a')
  to('splash', 'user_b')
  expect(result.current.cards).toEqual([])
  to('unavailable', null)
  expect(result.current.cards).toEqual([])
})
