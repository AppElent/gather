import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { internal } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'

function membershipEvent() {
  return {
    kind: 'membership.upsert' as const,
    clerkMembershipId: 'mem_1',
    clerkOrganizationId: 'org_1',
    clerkUserId: 'user_1',
    role: 'member' as const,
  }
}

function membershipContext() {
  return {
    membership: {
      clerkOrganizationName: 'Wine Club',
      userName: 'Ada Lovelace',
      userEmail: 'ada@example.com',
      userImageUrl: 'https://example.com/ada.png',
    },
  }
}

describe('Clerk projection sync', () => {
  test('replaying a membership event leaves one projection row', async () => {
    const t = convexTest(schema, modules)
    const event = membershipEvent()
    const context = membershipContext()

    await t.mutation((internal as any).clerkSync.apply, { event, context })
    await t.mutation((internal as any).clerkSync.apply, { event, context })

    expect(await t.run((ctx) => ctx.db.query('spaceMemberships').collect())).toHaveLength(1)
  })

  test('membership projection uses verified payload context for missing Space and user', async () => {
    const t = convexTest(schema, modules)

    await t.mutation((internal as any).clerkSync.apply, {
      event: membershipEvent(),
      context: membershipContext(),
    })

    const [space] = await t.run((ctx) => ctx.db.query('spaces').collect())
    const [user] = await t.run((ctx) => ctx.db.query('users').collect())
    expect(space).toMatchObject({ name: 'Wine Club' })
    expect(user).toMatchObject({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      imageUrl: 'https://example.com/ada.png',
    })
  })

  test('membership projection does not rename an existing Gather Space', async () => {
    const t = convexTest(schema, modules)
    await t.mutation((internal as any).clerkSync.apply, {
      event: {
        kind: 'space.upsert',
        clerkOrganizationId: 'org_1',
        name: 'Wine Club',
      },
    })

    await t.mutation((internal as any).clerkSync.apply, {
      event: membershipEvent(),
      context: {
        membership: {
          clerkOrganizationName: 'Stale Membership Payload',
          userName: 'Ada Lovelace',
          userEmail: 'ada@example.com',
        },
      },
    })

    const [space] = await t.run((ctx) => ctx.db.query('spaces').collect())
    expect(space).toMatchObject({ name: 'Wine Club' })
  })

  test('a deleted organization finalizes a Space already marked deleting', async () => {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      await ctx.db.insert('spaces', {
        clerkOrganizationId: 'org_1',
        slug: 'wine-club',
        name: 'Wine Club',
        status: 'deleting',
        defaultPinnedModuleIds: [],
        defaultDashboard: [],
        createdAt: 1,
        updatedAt: 1,
      })
    })

    await t.mutation((internal as any).clerkSync.apply, {
      event: { kind: 'space.delete', clerkOrganizationId: 'org_1' },
    })

    expect(
      await t.run((ctx) =>
        ctx.db
          .query('spaces')
          .withIndex('by_clerk_organization', (q) =>
            q.eq('clerkOrganizationId', 'org_1'),
          )
          .unique(),
      ),
    ).toBeNull()
  })

  test('only updates a shared user after it has a Gather membership', async () => {
    const t = convexTest(schema, modules)
    await t.mutation((internal as any).clerkSync.apply, {
      event: {
        kind: 'user.upsert',
        clerkUserId: 'user_other_product',
        name: 'Other',
        email: 'other@example.com',
      },
    })

    expect(await t.run((ctx) => ctx.db.query('users').collect())).toEqual([])
  })
})
