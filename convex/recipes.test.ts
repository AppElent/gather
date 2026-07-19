import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'

async function createFixture() {
  const t = convexTest(schema, modules)
  const wine = await t.mutation((internal as any).spaces.provisionTagged, {
    clerkOrganizationId: 'org_wine',
    clerkOrganizationName: 'Wine Club',
    creatorClerkUserId: 'user_admin',
  })
  const home = await t.mutation((internal as any).spaces.provisionTagged, {
    clerkOrganizationId: 'org_home',
    clerkOrganizationName: 'Home',
    creatorClerkUserId: 'user_home',
  })
  const admin = t.withIdentity({
    subject: 'user_admin',
    org_id: 'org_wine',
    org_role: 'org:admin',
  })
  const member = t.withIdentity({
    subject: 'user_member',
    org_id: 'org_wine',
    org_role: 'org:member',
  })
  await member.mutation((api as any).users.ensureUser, {})
  await admin.mutation((api as any).spaceModules.setState, {
    spaceSlug: wine.spaceSlug,
    moduleId: 'recipes',
    state: 'enabled',
  })
  return { admin, home, member, t, wine }
}

const recipeInput = {
  title: 'Mushroom risotto',
  ingredients: ['rice'],
  steps: ['stir'],
  tags: ['dinner'],
}

describe('Space Recipes', () => {
  test('a member can create, update, and remove a recipe in the signed active Space', async () => {
    const { member, t, wine } = await createFixture()

    const id = await member.mutation((api as any).recipes.create, {
      spaceSlug: wine.spaceSlug,
      ...recipeInput,
    })
    await member.mutation((api as any).recipes.update, {
      spaceSlug: wine.spaceSlug,
      id,
      ...recipeInput,
      title: 'Shared edit',
    })

    expect(await member.query((api as any).recipes.get, { spaceSlug: wine.spaceSlug, id })).toMatchObject({
      title: 'Shared edit',
      spaceId: wine.spaceId,
    })
    await member.mutation((api as any).recipes.remove, { spaceSlug: wine.spaceSlug, id })
    expect(await t.run((ctx) => ctx.db.get(id))).toBeNull()
  })

  test('never exposes a recipe through another Space slug', async () => {
    const { admin, home, member, wine } = await createFixture()
    const id = await admin.mutation((api as any).recipes.create, {
      spaceSlug: wine.spaceSlug,
      ...recipeInput,
    })

    await expect(member.query((api as any).recipes.get, { spaceSlug: home.spaceSlug, id })).rejects.toThrow(
      'Active organization does not match Space',
    )
  })

  test('does not let another signed active Space read a Wine Space recipe', async () => {
    const { admin, home, t, wine } = await createFixture()
    const id = await admin.mutation((api as any).recipes.create, {
      spaceSlug: wine.spaceSlug,
      ...recipeInput,
    })
    const homeMember = t.withIdentity({
      subject: 'user_home',
      org_id: 'org_home',
      org_role: 'org:admin',
    })

    await expect(homeMember.query((api as any).recipes.get, { spaceSlug: wine.spaceSlug, id })).rejects.toThrow(
      'Active organization does not match Space',
    )
    expect(await homeMember.query((api as any).recipes.list, { spaceSlug: home.spaceSlug })).toEqual([])
  })
  test('a member can update and remove a recipe created by another Space member', async () => {
    const { admin, member, t, wine } = await createFixture()
    const id = await admin.mutation((api as any).recipes.create, {
      spaceSlug: wine.spaceSlug,
      ...recipeInput,
    })
    const created = await t.run((ctx) => ctx.db.get(id))

    await member.mutation((api as any).recipes.update, {
      spaceSlug: wine.spaceSlug,
      id,
      title: 'Edited by a member',
    })

    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
      title: 'Edited by a member',
      createdByUserId: (created as any)?.createdByUserId,
    })
    await member.mutation((api as any).recipes.remove, {
      spaceSlug: wine.spaceSlug,
      id,
    })
    expect(await t.run((ctx) => ctx.db.get(id))).toBeNull()
  })
})
