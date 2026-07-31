import { describe, expect, test } from 'vitest'
import { testConvex } from '../test/convexHarness'
import { api } from './_generated/api'
import { MAX_PINNED_MODULES } from './users'

/**
 * Pins, asserted through the real mutation and the real query.
 *
 * The rule that matters is the one a household would notice being broken: a
 * Pin is personal, so a housemate reordering theirs must not move yours. The
 * order is part of the answer, not an implementation detail — it is what the
 * navigation renders.
 */

type Harness = ReturnType<typeof testConvex>

const asAlice = { subject: 'clerk_alice', name: 'Alice', email: 'a@example.com' }
const asBob = { subject: 'clerk_bob', name: 'Bob', email: 'b@example.com' }

async function signUp(t: Harness, identity: typeof asAlice) {
  await t.withIdentity(identity).mutation(api.users.ensureUser, {})
}

async function setPins(
  t: Harness,
  identity: typeof asAlice,
  moduleIds: string[],
) {
  await t.withIdentity(identity).mutation(api.users.setPins, { moduleIds })
}

async function pinsOf(t: Harness, identity: typeof asAlice) {
  const user = await t.withIdentity(identity).query(api.users.me, {})
  return user?.pinnedModuleIds
}

describe('my Pins', () => {
  test('are absent until I choose, so a default can be applied in code', async () => {
    const t = testConvex()
    await signUp(t, asAlice)

    expect(await pinsOf(t, asAlice)).toBeUndefined()
  })

  test('read back in the order I set them', async () => {
    const t = testConvex()
    await signUp(t, asAlice)

    await setPins(t, asAlice, ['tasks', 'recipes', 'nutrition'])
    expect(await pinsOf(t, asAlice)).toEqual(['tasks', 'recipes', 'nutrition'])

    await setPins(t, asAlice, ['nutrition', 'tasks'])
    expect(await pinsOf(t, asAlice)).toEqual(['nutrition', 'tasks'])
  })

  test('can be emptied, which is not the same as never having chosen', async () => {
    const t = testConvex()
    await signUp(t, asAlice)

    await setPins(t, asAlice, [])
    expect(await pinsOf(t, asAlice)).toEqual([])
  })

  test('are invisible to every other member', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    await signUp(t, asBob)

    await setPins(t, asAlice, ['recipes', 'tasks'])
    await setPins(t, asBob, ['baby-log'])

    expect(await pinsOf(t, asAlice)).toEqual(['recipes', 'tasks'])
    expect(await pinsOf(t, asBob)).toEqual(['baby-log'])
  })

  test('keep the first of a repeated id and no more', async () => {
    const t = testConvex()
    await signUp(t, asAlice)

    await setPins(t, asAlice, ['recipes', 'tasks', 'recipes'])
    expect(await pinsOf(t, asAlice)).toEqual(['recipes', 'tasks'])
  })

  test('stop at the cap rather than growing without bound', async () => {
    const t = testConvex()
    await signUp(t, asAlice)

    const many = Array.from(
      { length: MAX_PINNED_MODULES + 5 },
      (_, i) => `module-${i}`,
    )
    await setPins(t, asAlice, many)

    expect(await pinsOf(t, asAlice)).toEqual(many.slice(0, MAX_PINNED_MODULES))
  })

  test('cannot be set by someone who is not signed in', async () => {
    const t = testConvex()
    await expect(
      t.mutation(api.users.setPins, { moduleIds: ['recipes'] }),
    ).rejects.toThrow(/Not authenticated/)
  })
})
