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
    id?: string
    deleteSelfEnabled?: boolean
    delete: () => Promise<void>
  } | null,
  // `undefined` is Clerk switching sessions; `null` is nobody signed in.
  sessionId: 'sess_1' as string | null | undefined,
  purge: (): Promise<void> => Promise.resolve(),
  apple: (): Promise<'continue' | 'cancelled' | 'changed'> =>
    Promise.resolve('continue'),
  // What the provider handed the Apple step, to ask it as that step does.
  appleOptions: null as null | {
    expectedSubject: string
    stillConfirmed: () => boolean
  },
  order: [] as string[],
  purgeArgs: [] as unknown[],
  signedOut: 0,
  told: 0,
}))

// One object, read live, as Clerk's is: a test changes the session without a
// render.
const clerk = vi.hoisted(() => ({
  get user() {
    return state.user
  },
  get session() {
    return state.sessionId ? { id: state.sessionId } : state.sessionId
  },
}))

vi.mock('@clerk/expo', () => ({
  useUser: () => ({ user: state.user }),
  useClerk: () => clerk,
}))
vi.mock('convex/react', () => ({
  useMutation: () => (args: unknown) => {
    state.order.push('purge')
    state.purgeArgs.push(args)
    return state.purge()
  },
  useAction: () => () => Promise.resolve(null),
}))
vi.mock('../../../convex/api', () => ({
  api: {
    accounts: {
      deleteAccount: 'accounts:deleteAccount',
      revokeAppleSignIn: 'accounts:revokeAppleSignIn',
    },
  },
}))
vi.mock('./apple-revocation', () => ({
  revokeAppleSignIn: (
    _user: unknown,
    _revoke: unknown,
    options: typeof state.appleOptions,
  ) => {
    state.appleOptions = options
    state.order.push('apple')
    return state.apple()
  },
}))
vi.mock('../../../auth/useSignOut', () => ({
  useForgetAccount: () => () => {
    state.order.push('forget')
  },
  useSignOut: () => () => {
    state.signedOut += 1
    state.order.push('signOut')
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
      onGatherDataDeleted={() => {
        state.told += 1
        state.order.push('told')
      }}
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
  state.told = 0
  state.sessionId = 'sess_1'
  state.purge = () => Promise.resolve()
  state.apple = () => Promise.resolve('continue')
  state.appleOptions = null
  state.order = []
  state.purgeArgs = []
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

    act(() => deletion.start('wholeAccount'))
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

    act(() => deletion.start('wholeAccount'))
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
    act(() => deletion.start('wholeAccount'))
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
    act(() => deletion.start('wholeAccount'))
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

    act(() => deletion.start('wholeAccount'))
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

    act(() => deletion.start('wholeAccount'))
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
      start('wholeAccount')
      start('wholeAccount')
    })
    purge.resolve()
    await settle()
    expect(purges).toBe(1)
  })
})

describe('an account that signs in with Apple (APP-213)', () => {
  test('the Apple grant is revoked before anything is deleted', async () => {
    view = render()
    act(() => deletion.start('wholeAccount'))
    await settle()
    expect(state.order).toEqual(['apple', 'purge', 'signOut'])
    expect(state.signedOut).toBe(1)
  })

  test('while the Apple sheet is up nothing is deleted, and a second tap starts nothing', async () => {
    const apple = deferred()
    state.apple = () => apple.promise.then(() => 'continue' as const)
    view = render()

    const { start } = deletion
    act(() => {
      start('wholeAccount')
      start('wholeAccount')
    })
    await settle()
    expect(view.container.textContent).toBe('delete screen: revokingApple')
    expect(state.order).toEqual(['apple'])

    apple.resolve()
    await settle()
    expect(state.order).toEqual(['apple', 'purge', 'signOut'])
  })

  test('dismissing the Apple sheet deletes nothing and can be tried again', async () => {
    let attempts = 0
    state.apple = () => Promise.resolve('cancelled')
    state.user = {
      deleteSelfEnabled: true,
      delete: () => {
        attempts += 1
        return Promise.resolve()
      },
    }
    view = render()

    act(() => deletion.start('wholeAccount'))
    await settle()
    expect(view.container.textContent).toBe('delete screen: idle')
    expect(state.order).toEqual(['apple'])
    expect(attempts).toBe(0)

    state.apple = () => Promise.resolve('continue')
    act(() => deletion.start('wholeAccount'))
    await settle()
    expect(state.order).toEqual(['apple', 'apple', 'purge', 'signOut'])
    expect(attempts).toBe(1)
  })

  test('leaving while the Apple sheet is up deletes nothing', async () => {
    const apple = deferred()
    state.apple = () => apple.promise.then(() => 'continue' as const)
    view = render()
    act(() => deletion.start('wholeAccount'))
    await settle()

    view.unmount()
    view = undefined
    apple.resolve()
    await settle()
    expect(state.order).toEqual(['apple'])
    expect(state.signedOut).toBe(0)
  })

  test('the purge names the account the person confirmed', async () => {
    state.user = {
      id: 'user_alex',
      deleteSelfEnabled: true,
      delete: () => Promise.resolve(),
    }
    view = render()
    act(() => deletion.start('wholeAccount'))
    await settle()
    expect(state.purgeArgs).toEqual([{ expectedSubject: 'user_alex' }])
  })
})

describe('deleting Gather data only (APP-397)', () => {
  test('purges with the login kept, then signs out and says so: no Apple, no Clerk deletion', async () => {
    let attempts = 0
    state.user = {
      id: 'user_alex',
      deleteSelfEnabled: true,
      delete: () => {
        attempts += 1
        return Promise.resolve()
      },
    }
    view = render()

    act(() => deletion.start('gatherData'))
    await settle()

    expect(state.order).toEqual(['purge', 'signOut', 'told'])
    expect(state.purgeArgs).toEqual([
      { expectedSubject: 'user_alex', keepLogin: true },
    ])
    expect(attempts).toBe(0)
    expect(view.container.textContent).toBe('underway: signingOut')
  })

  test('needs no permission from Clerk to delete the login', async () => {
    state.user = { deleteSelfEnabled: false, delete: () => Promise.resolve() }
    view = render()

    act(() => deletion.start('gatherData'))
    await settle()

    expect(state.order).toEqual(['purge', 'signOut', 'told'])
  })

  test('a purge refusal stays on the delete screen and signs nothing out', async () => {
    state.purge = () => Promise.reject(new Error('refused'))
    view = render()

    act(() => deletion.start('gatherData'))
    await settle()

    expect(view.container.textContent).toBe('delete screen: refused')
    expect(deletion.state).toMatchObject({ step: 'refused', choice: 'gatherData' })
    expect(state.signedOut).toBe(0)
    expect(state.told).toBe(0)
  })

  test('a second tap before the first has rendered purges once', async () => {
    const purge = deferred()
    let purges = 0
    state.purge = () => {
      purges += 1
      return purge.promise
    }
    view = render()

    const { start } = deletion
    act(() => {
      start('gatherData')
      start('wholeAccount')
    })
    purge.resolve()
    await settle()
    expect(purges).toBe(1)
    expect(state.order).not.toContain('apple')
  })
})

describe('a session that changes after the confirmation (APP-396)', () => {
  let deleted: string[]
  const person = (id: string) => ({
    id,
    deleteSelfEnabled: true,
    delete: () => {
      deleted.push(id)
      return Promise.resolve()
    },
  })

  beforeEach(() => {
    deleted = []
    state.user = person('user_alex')
  })

  const changes: [string, () => void][] = [
    [
      'another account signed in',
      () => {
        state.user = person('user_sam')
        state.sessionId = 'sess_2'
      },
    ],
    [
      'the same account signed in again',
      () => {
        state.sessionId = 'sess_2'
      },
    ],
    [
      'nobody signed in',
      () => {
        state.user = null
        state.sessionId = null
      },
    ],
  ]

  test.each(changes)(
    '%s during the purge: no login is deleted, and the stranded state says so',
    async (_, change) => {
      const purge = deferred()
      state.purge = () => purge.promise
      view = render()
      act(() => deletion.start('wholeAccount'))
      await settle()

      change()
      purge.resolve()
      await settle()
      expect(view.container.textContent).toBe('underway: stranded')
      expect(deleted).toEqual([])
      expect(state.signedOut).toBe(0)

      act(() => deletion.retryLogin())
      await settle()
      expect(view.container.textContent).toBe('underway: stranded')
      expect(deleted).toEqual([])
      expect(state.signedOut).toBe(0)
    },
  )

  test('signing out and another sign-in unmount the run: the new login is not deleted or signed out', async () => {
    const purge = deferred()
    state.purge = () => purge.promise
    view = render()
    act(() => deletion.start('wholeAccount'))
    await settle()

    view.unmount()
    view = undefined
    state.user = person('user_sam')
    state.sessionId = 'sess_2'
    purge.resolve()
    await settle()
    expect(deleted).toEqual([])
    expect(state.signedOut).toBe(0)
  })

  test.each(changes)(
    '%s while the Apple sheet is up: nothing is deleted',
    async (_, change) => {
      const apple = deferred()
      state.apple = () => apple.promise.then(() => 'continue' as const)
      view = render()
      act(() => deletion.start('wholeAccount'))
      await settle()

      change()
      apple.resolve()
      await settle()
      expect(view.container.textContent).toBe('delete screen: refused')
      expect(state.purgeArgs).toEqual([])
      expect(deleted).toEqual([])
    },
  )

  test.each(changes)(
    '%s while the Apple sheet is up: the Apple step is told before the code is sent (APP-745)',
    async (_, change) => {
      const apple = deferred()
      state.apple = () => apple.promise.then(() => 'changed' as const)
      view = render()
      act(() => deletion.start('wholeAccount'))
      await settle()
      expect(state.appleOptions?.expectedSubject).toBe('user_alex')
      expect(state.appleOptions?.stillConfirmed()).toBe(true)

      change()
      expect(state.appleOptions?.stillConfirmed()).toBe(false)
      apple.resolve()
      await settle()
      expect(view.container.textContent).toBe('delete screen: refused')
      expect(state.purgeArgs).toEqual([])
      expect(deleted).toEqual([])
    },
  )

  test('a confirmation alert that outlives its session: the Apple step is told at once, and nothing is deleted (APP-745)', async () => {
    view = render()
    const { start } = deletion
    state.user = person('user_sam')
    state.sessionId = 'sess_2'
    let confirmedAtTheStart: boolean | undefined
    state.apple = () => {
      confirmedAtTheStart = state.appleOptions?.stillConfirmed()
      return Promise.resolve('changed')
    }

    act(() => start('wholeAccount'))
    await settle()
    expect(confirmedAtTheStart).toBe(false)
    expect(view.container.textContent).toBe('delete screen: refused')
    expect(state.purgeArgs).toEqual([])
  })

  test.each(['gatherData', 'wholeAccount'] as const)(
    'a confirmation alert that outlives the provider starts nothing: %s (APP-745)',
    async (choice) => {
      view = render()
      const { start } = deletion
      view.unmount()
      view = undefined

      start(choice)
      await settle()
      expect(state.order).toEqual([])
    },
  )

  test('another account signed in before the gatherData purge: nothing is deleted (APP-745)', async () => {
    view = render()
    const { start } = deletion
    state.user = person('user_sam')
    state.sessionId = 'sess_2'

    act(() => start('gatherData'))
    await settle()
    expect(deletion.state).toMatchObject({
      step: 'refused',
      choice: 'gatherData',
    })
    expect(state.order).toEqual([])
  })

  test.each([
    ...changes.slice(0, 2),
    [
      'Clerk switching sessions',
      () => {
        state.user = null
        state.sessionId = undefined
      },
    ] as [string, () => void],
  ])(
    '%s during the gatherData purge: nobody is signed out or told, and the app is given back (APP-746)',
    async (_, change) => {
      const purge = deferred()
      state.purge = () => purge.promise
      view = render()
      act(() => deletion.start('gatherData'))
      await settle()

      change()
      purge.resolve()
      await settle()
      expect(state.order).toEqual(['purge'])
      expect(view.container.textContent).toBe('delete screen: idle')
    },
  )

  test.each([false, true])(
    'nobody signed in after the gatherData purge: this phone forgets the account, and nobody is signed out or told (provider unmounted: %s) (APP-771)',
    async (unmounted) => {
      const purge = deferred()
      state.purge = () => purge.promise
      view = render()
      act(() => deletion.start('gatherData'))
      await settle()

      state.user = null
      state.sessionId = null
      if (unmounted) {
        view.unmount()
        view = undefined
      }
      purge.resolve()
      await settle()
      expect(state.order).toEqual(['purge', 'forget'])
      if (view)
        expect(view.container.textContent).toBe('delete screen: idle')
    },
  )

  test.each(changes.slice(0, 2))(
    '%s while Clerk deletes the login: the new session is not signed out (APP-746)',
    async (_, change) => {
      const clerkDelete = deferred()
      state.user = { ...person('user_alex'), delete: () => clerkDelete.promise }
      view = render()
      act(() => deletion.start('wholeAccount'))
      await settle()
      expect(view.container.textContent).toBe('underway: deletingLogin')

      change()
      clerkDelete.resolve()
      await settle()
      expect(state.signedOut).toBe(0)
      expect(view.container.textContent).toBe('delete screen: idle')
    },
  )

  test('Clerk ending the session with the login still clears this phone (APP-746)', async () => {
    const clerkDelete = deferred()
    state.user = { ...person('user_alex'), delete: () => clerkDelete.promise }
    view = render()
    act(() => deletion.start('wholeAccount'))
    await settle()

    state.user = null
    state.sessionId = null
    clerkDelete.resolve()
    await settle()
    expect(state.signedOut).toBe(1)
  })
})
