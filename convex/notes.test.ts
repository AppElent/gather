import { describe, expect, test } from 'vitest'
import { testConvex } from '../test/convexHarness'
import { api } from './_generated/api'

const alice = {
  subject: 'notes_alice',
  name: 'Alice',
  email: 'notes@example.com',
}
const bob = { subject: 'notes_bob', name: 'Bob', email: 'bob@example.com' }

async function seed() {
  const t = testConvex()
  const ids = await t.run(async (ctx) => {
    const aliceId = await ctx.db.insert('users', {
      clerkId: alice.subject,
      name: alice.name,
      email: alice.email,
    })
    const bobId = await ctx.db.insert('users', {
      clerkId: bob.subject,
      name: bob.name,
      email: bob.email,
    })
    const first = await ctx.db.insert('groups', {
      name: 'First',
      slug: 'notes-first',
      inviteCode: 'first',
      isPersonal: false,
    })
    const second = await ctx.db.insert('groups', {
      name: 'Second',
      slug: 'notes-second',
      inviteCode: 'second',
      isPersonal: false,
    })
    await ctx.db.insert('memberships', {
      groupId: first,
      userId: aliceId,
      role: 'admin',
    })
    await ctx.db.insert('memberships', {
      groupId: second,
      userId: aliceId,
      role: 'member',
    })
    await ctx.db.insert('memberships', {
      groupId: second,
      userId: bobId,
      role: 'admin',
    })
    const firstNote = await ctx.db.insert('notes', {
      groupId: first,
      title: 'First note',
      body: 'Only in the first household',
      pinned: true,
      createdBy: aliceId,
      updatedAt: 1,
    })
    await ctx.db.insert('notes', {
      groupId: second,
      title: 'Second note',
      body: 'Only in the second household',
      pinned: false,
      createdBy: bobId,
      updatedAt: 2,
    })
    return { firstNote }
  })
  return { t, ...ids }
}

describe('notes through a Group address', () => {
  test('a Member of both Groups sees each household only at its own address', async () => {
    const { t } = await seed()
    const first = await t
      .withIdentity(alice)
      .query(api.notes.list, { groupSlug: 'notes-first' })
    const second = await t
      .withIdentity(alice)
      .query(api.notes.list, { groupSlug: 'notes-second' })
    expect(first).toHaveLength(1)
    expect(first[0]).toMatchObject({ title: 'First note', pinned: true })
    expect(second).toHaveLength(1)
    expect(second[0]).toMatchObject({ title: 'Second note', pinned: false })
  })

  test('a non-member is refused', async () => {
    const { t } = await seed()
    await expect(
      t.withIdentity(bob).query(api.notes.list, { groupSlug: 'notes-first' }),
    ).rejects.toThrow(/Not a member/)
  })

  test('create, update, and remove stay at the addressed Group', async () => {
    const { t, firstNote } = await seed()
    const created = await t.withIdentity(alice).mutation(api.notes.create, {
      groupSlug: 'notes-first',
      title: 'New note',
      body: 'Draft',
    })
    await t.withIdentity(alice).mutation(api.notes.update, {
      groupSlug: 'notes-first',
      noteId: created,
      body: 'Changed',
      pinned: true,
    })
    const notes = await t
      .withIdentity(alice)
      .query(api.notes.list, { groupSlug: 'notes-first' })
    expect(notes.find((note) => note._id === created)).toMatchObject({
      body: 'Changed',
      pinned: true,
    })
    await t.withIdentity(alice).mutation(api.notes.remove, {
      groupSlug: 'notes-first',
      noteId: firstNote,
    })
    await expect(
      t.withIdentity(alice).mutation(api.notes.update, {
        groupSlug: 'notes-second',
        noteId: firstNote,
        title: 'Nope',
      }),
    ).rejects.toThrow(/Note not found/)
  })
})
