// @vitest-environment jsdom
import { act, useState } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { mount } from '../testing/dom'
import {
  type GroupContextValue,
  GroupProvider,
  GroupScoped,
  useGroup,
} from './GroupProvider'

type Row = { _id: string; name: string; slug: string }

const state = vi.hoisted(() => ({
  myGroups: undefined as Row[] | undefined,
  retained: null as string | null,
}))

vi.mock('@clerk/expo', () => ({ useAuth: () => ({ userId: 'user_a' }) }))
vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
}))
vi.mock('../convex/queries', () => ({ useQuery: () => state.myGroups }))
vi.mock('./retainedGroup', () => ({
  readRetainedGroup: () => state.retained,
  writeRetainedGroup: (id: string) => {
    state.retained = id
  },
  clearRetainedGroup: () => {
    state.retained = null
  },
}))

const kitchen = { _id: 'g_kitchen', name: 'Kitchen', slug: 'kitchen' }
const willow = { _id: 'g_willow', name: 'Willow Street', slug: 'willow' }

/** Every render of a Group-scoped screen, and every unwind, in order. */
let log: string[]
/** What the shell chrome saw, latest last. */
const seen: GroupContextValue[] = []
const current = () => seen[seen.length - 1]

/** Shell chrome outside the stacks: always drawn, always in the live Group. */
function Chrome() {
  seen.push(useGroup())
  return null
}

/**
 * A pushed screen holding one Group's record, standing in for every real one.
 * It fails if it renders after its Group has gone — Convex delivers that
 * refusal in the same update that drops the Group from `groups.myGroups` —
 * and it records rendering under a Group that is not its own.
 */
function Screen() {
  const { group } = useGroup()
  const [heldFor] = useState(group._id)
  if (!state.myGroups?.some((row) => row._id === heldFor)) {
    throw new Error(`a ${heldFor} screen rendered after ${heldFor} went`)
  }
  log.push(
    heldFor === group._id ? `render ${group._id}` : `stale ${heldFor} screen`,
  )
  return null
}

function tree() {
  return (
    <GroupProvider
      pending={null}
      none={null}
      onSwitch={() => log.push('unwind')}
    >
      <Chrome />
      <GroupScoped>
        <Screen />
      </GroupScoped>
    </GroupProvider>
  )
}

function unwinds() {
  return log.filter((entry) => entry === 'unwind').length
}

beforeEach(() => {
  log = []
  seen.length = 0
  state.myGroups = [kitchen, willow]
  state.retained = kitchen._id
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('GroupProvider unwinds the stacks when the Group on screen changes', () => {
  test('not for the first Group after sign-in', () => {
    mount(tree())

    expect(current().group).toEqual(kitchen)
    expect(unwinds()).toBe(0)
    expect(log).toContain(`render ${kitchen._id}`)
  })

  test('on a switch, before a Group-scoped screen renders in the new Group', () => {
    mount(tree())
    const start = log.length

    act(() => current().setGroup(willow._id))

    const after = log.slice(start)
    expect(unwinds()).toBe(1)
    expect(after.indexOf(`render ${willow._id}`)).toBeGreaterThan(
      after.indexOf('unwind'),
    )
    expect(log).not.toContainEqual(expect.stringMatching(/^stale/))
    expect(current().group).toEqual(willow)
  })

  test('when a membership ends and the fallback picks another Group', () => {
    const view = mount(tree())
    const start = log.length

    // Removed from Kitchen while the app is open. Without the gate the pushed
    // Kitchen screen re-renders in this update and throws.
    state.myGroups = [willow]
    view.rerender(tree())

    const after = log.slice(start)
    expect(unwinds()).toBe(1)
    expect(after.indexOf(`render ${willow._id}`)).toBeGreaterThan(
      after.indexOf('unwind'),
    )
    expect(log).not.toContainEqual(expect.stringMatching(/^stale/))
    expect(current().group).toEqual(willow)
    expect(state.retained).toBe(willow._id)
  })

  test('not when the Group on screen is only renamed', () => {
    const view = mount(tree())

    state.myGroups = [{ ...kitchen, name: 'The Kitchen' }, willow]
    view.rerender(tree())

    expect(current().group.name).toBe('The Kitchen')
    expect(unwinds()).toBe(0)
  })

  test('not when switching to the Group already on screen', () => {
    mount(tree())

    act(() => current().setGroup(kitchen._id))

    expect(unwinds()).toBe(0)
  })

  test('once per change', () => {
    mount(tree())

    act(() => current().setGroup(willow._id))
    act(() => current().setGroup(kitchen._id))

    expect(unwinds()).toBe(2)
    expect(current().group).toEqual(kitchen)
  })
})
