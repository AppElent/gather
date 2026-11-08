// @vitest-environment jsdom
import { act, useState } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import type { Id } from '../convex/api'
import { GroupLinkHandoff } from '../shell/GroupLinkHandoff'
import { rememberGroupLink } from '../shell/pendingGroupLink'
import { mount } from '../testing/dom'
import {
  type GroupContextValue,
  GroupProvider,
  GroupScoped,
  useGroup,
  useOpenInGroup,
} from './GroupProvider'

type Row = { _id: Id<'groups'>; name: string; slug: string }

const state = vi.hoisted(() => ({
  myGroups: undefined as Row[] | undefined,
  retained: null as string | null,
  replaced: [] as unknown[],
}))

vi.mock('expo-router', () => ({
  router: {
    replace: (href: unknown) => {
      state.replaced.push(href)
    },
  },
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

const kitchen: Row = {
  _id: 'g_kitchen' as Id<'groups'>,
  name: 'Kitchen',
  slug: 'kitchen',
}
const willow: Row = {
  _id: 'g_willow' as Id<'groups'>,
  name: 'Willow Street',
  slug: 'willow',
}

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
  state.replaced = []
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

describe('opening something in another Group', () => {
  let openInGroup: ReturnType<typeof useOpenInGroup>

  /** Stands in for a Drop screen: above the tabs, so never Group-scoped. */
  function Opener() {
    openInGroup = useOpenInGroup()
    return null
  }

  function opener() {
    return (
      <GroupProvider
        pending={null}
        none={null}
        onSwitch={() => log.push('unwind')}
      >
        <Chrome />
        <Opener />
      </GroupProvider>
    )
  }

  test('opens only after the switch has unwound the stacks', () => {
    mount(opener())

    act(() => openInGroup(willow._id, () => log.push(`open in ${current().group._id}`)))

    expect(log).toEqual(['unwind', `open in ${willow._id}`])
    expect(state.retained).toBe(willow._id)
  })

  test('in the Group already on screen, opens without unwinding', () => {
    mount(opener())

    act(() => openInGroup(kitchen._id, () => log.push('open')))

    expect(log).toEqual(['open'])
  })
})

describe('an old /g/<slug> link', () => {
  function handoff() {
    return (
      <GroupProvider
        pending={null}
        none={null}
        onSwitch={() => state.replaced.push('unwind')}
      >
        <Chrome />
        <GroupLinkHandoff />
      </GroupProvider>
    )
  }

  test('names its Group by slug, switches to it, then opens', () => {
    rememberGroupLink({ groupSlug: willow.slug, segments: ['cheeses'] })

    mount(handoff())

    expect(current().group).toEqual(willow)
    expect(state.retained).toBe(willow._id)
    expect(state.replaced).toEqual(['unwind', '/all/tasting/cheese'])
  })

  test('to a Group the Member is not in leaves the Group alone', () => {
    rememberGroupLink({ groupSlug: 'elsewhere', segments: ['cheeses'] })

    mount(handoff())

    expect(current().group).toEqual(kitchen)
    expect(state.replaced).toEqual(['/home'])
  })

  test('to a screen the phone lacks leaves the Group alone', () => {
    rememberGroupLink({ groupSlug: willow.slug, segments: ['spirits'] })

    mount(handoff())

    expect(current().group).toEqual(kitchen)
    expect(state.replaced).toEqual(['/home'])
  })
})
