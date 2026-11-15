// @vitest-environment jsdom
import { StrictMode } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import type { Id } from '../../../convex/api'
import { mount, settle } from '../../../testing/dom'
import { useMarkUsedOnce } from './use-mark-used-once'

const calls = vi.hoisted(() => [] as unknown[])

vi.mock('../../../convex/api', () => ({
  api: { loyaltyCards: { markUsed: 'loyaltyCards:markUsed' } },
}))
vi.mock('convex/react', () => {
  const markUsed = async (args: unknown) => {
    calls.push(args)
  }
  return { useMutation: () => markUsed }
})

function Card({ id, tick }: { id: string; tick: number }) {
  useMarkUsedOnce('home', id as Id<'loyaltyCards'>)
  return <p>{tick}</p>
}

beforeEach(() => {
  calls.length = 0
})

test('marks a card used once per open, through re-renders and a double mount', async () => {
  const view = mount(
    <StrictMode>
      <Card id="card-1" tick={0} />
    </StrictMode>,
  )
  view.rerender(
    <StrictMode>
      <Card id="card-1" tick={1} />
    </StrictMode>,
  )
  await settle()
  expect(calls).toEqual([{ groupSlug: 'home', id: 'card-1' }])
  view.unmount()
})

test('marks the next card when the screen shows another', async () => {
  const view = mount(<Card id="card-1" tick={0} />)
  view.rerender(<Card id="card-2" tick={0} />)
  await settle()
  expect(calls).toEqual([
    { groupSlug: 'home', id: 'card-1' },
    { groupSlug: 'home', id: 'card-2' },
  ])
  view.unmount()
})

test('opening the card again is a new use', async () => {
  mount(<Card id="card-1" tick={0} />).unmount()
  mount(<Card id="card-1" tick={0} />).unmount()
  await settle()
  expect(calls).toHaveLength(2)
})
