// @vitest-environment jsdom
import { act, useState } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { mount, settle } from '../../../testing/dom'
import {
  AccountDeleteProvider,
  type AccountDeleteValue,
  useAccountDelete,
} from './account-delete-provider'

const state = vi.hoisted(() => ({
  user: null as {
    deleteSelfEnabled?: boolean
    delete: () => Promise<void>
  } | null,
  purge: (): Promise<void> => Promise.resolve(),
  signedOut: 0,
}))

vi.mock('@clerk/expo', () => ({ useUser: () => ({ user: state.user }) }))
vi.mock('convex/react', () => ({ useMutation: () => () => state.purge() }))
vi.mock('../../../convex/api', () => ({
  api: { accounts: { deleteAccount: 'accounts:deleteAccount' } },
}))
vi.mock('../../../auth/useSignOut', () => ({
  useSignOut: () => () => {
    state.signedOut += 1
  },
}))

/** Resolved or rejected by the test, so it decides what lands first. */
function deferred() {
  let resolve!: () => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<void>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

/** Stands in for `GroupProvider`: draws the delete screen only while the
 * person is still in a Group, and loses it when the purge empties the list. */
let emptyGroups: () => void
function GroupGate() {
  const [inAGroup, setInAGroup] = useState(true)
  emptyGroups = () => setInAGroup(false)
  return inAGroup ? <DeleteScreen /> : <p>no group</p>
}

let deletion: AccountDeleteValue
function DeleteScreen() {
  deletion = useAccountDelete()
  const { state: current } = deletion
  return (
    <p>
      delete screen:{' '}
{current.step}
    </p>
  )
}

function render() {
  return mount(
    <AccountDeleteProvider
      underway={(value) => {
        deletion = value
        return <p>underway: {value.state.step}</p>
      }}
    >
      <GroupGate />
    </AccountDeleteProvider>,
  )
}

let view: ReturnType<typeof mount> | undefined

beforeEach(() => {
  state.signedOut = 0
  state.purge = () => Promise.resolve()
  state.user = { deleteSelfEnabled: true, delete: () => Promise.resolve() }
})

afterEach(() => {
  view?.unmount()
  view = undefined
})

describe('deleting the account', () => {
  test('a Clerk refusal is shown even after the purge has taken the delete screen away (#233)', async () => {
    const purge = deferred()
    const clerk = deferred()
    state.purge = () => purge.promise
    state.user = { deleteSelfEnabled: true, delete: () => clerk.promise }
    view = render()

    act(() => deletion.start())
    await settle()
    expect(view.container.textContent).toBe('delete screen: purging')

    // The scheduled purge empties the Group list before the mutation's answer
    // is back: `GroupProvider` swaps the screen out mid-deletion.
    act(() => {
      emptyGroups()
      purge.resolve()
    })
    await settle()
    expect(view.container.textContent).toBe('underway: deletingLogin')

    clerk.reject(new Error('Clerk refused'))
    await settle()
    expect(view.container.textContent).toBe('underway: stranded')
    expect(state.signedOut).toBe(0)
  })

  test('a refused login can be asked for again, without purging again, and then signs out', async () => {
    let purges = 0
    let attempts = 0
    state.purge = () => {
      purges += 1
      return Promise.resolve()
    }
    state.user = {
      deleteSelfEnabled: true,
      delete: () => {
        attempts += 1
        return attempts === 1
          ? Promise.reject(new Error('network'))
          : Promise.resolve()
      },
    }
    view = render()

    act(() => deletion.start())
    await settle()
    expect(view.container.textContent).toBe('underway: stranded')

    act(() => deletion.retryLogin())
    await settle()
    expect(attempts).toBe(2)
    expect(purges).toBe(1)
    expect(state.signedOut).toBe(1)
  })

  test('a second Try again tap before the first has rendered asks Clerk once', async () => {
    let attempts = 0
    const clerk = deferred()
    state.user = {
      deleteSelfEnabled: true,
      delete: () => {
        attempts += 1
        return attempts === 1
          ? Promise.reject(new Error('network'))
          : clerk.promise
      },
    }
    view = render()
    act(() => deletion.start())
    await settle()

    const { retryLogin } = deletion
    act(() => {
      retryLogin()
      retryLogin()
    })
    clerk.resolve()
    await settle()
    expect(attempts).toBe(2)
    expect(state.signedOut).toBe(1)
  })

  test('Clerk agreeing signs out', async () => {
    view = render()
    act(() => deletion.start())
    await settle()
    expect(state.signedOut).toBe(1)
  })

  test('a purge refusal stays on the delete screen and never reaches Clerk', async () => {
    let attempts = 0
    state.purge = () => Promise.reject(new Error('refused'))
    state.user = {
      deleteSelfEnabled: true,
      delete: () => {
        attempts += 1
        return Promise.resolve()
      },
    }
    view = render()

    act(() => deletion.start())
    await settle()
    expect(view.container.textContent).toBe('delete screen: refused')
    expect(attempts).toBe(0)
    expect(state.signedOut).toBe(0)
  })

  test('does nothing unless Clerk allows self-deletion', async () => {
    let purges = 0
    state.purge = () => {
      purges += 1
      return Promise.resolve()
    }
    state.user = { deleteSelfEnabled: false, delete: () => Promise.resolve() }
    view = render()

    act(() => deletion.start())
    await settle()
    expect(purges).toBe(0)
    expect(view.container.textContent).toBe('delete screen: idle')
  })

  test('a second tap before the first has rendered does not start a second purge', async () => {
    let purges = 0
    const purge = deferred()
    state.purge = () => {
      purges += 1
      return purge.promise
    }
    view = render()

    const { start } = deletion
    act(() => {
      start()
      start()
    })
    purge.resolve()
    await settle()
    expect(purges).toBe(1)
  })
})
