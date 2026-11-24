import { describe, expect, test } from 'vitest'
import { seedGroup, seedMember, testConvex } from '../test/convexHarness'
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
    const first = await seedGroup(ctx, {
      name: 'First',
      slug: 'notes-first',
      inviteCode: 'first',
    })
    const second = await seedGroup(ctx, {
      name: 'Second',
      slug: 'notes-second',
      inviteCode: 'second',
    })
    await seedMember(ctx, first, aliceId, 'admin')
    await seedMember(ctx, second, aliceId, 'member')
    await seedMember(ctx, second, bobId, 'admin')
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

  test('create takes pinned, and one idempotency key makes one note', async () => {
    const { t } = await seed()
    const args = {
      groupSlug: 'notes-first',
      title: 'Wifi',
      body: 'gather-gast',
      pinned: true,
      idempotencyKey: 'composer-note-1',
    }
    const first = await t.withIdentity(alice).mutation(api.notes.create, args)
    const again = await t.withIdentity(alice).mutation(api.notes.create, args)
    expect(again).toBe(first)
    const notes = await t
      .withIdentity(alice)
      .query(api.notes.list, { groupSlug: 'notes-first' })
    expect(notes.filter((note) => note.title === 'Wifi')).toEqual([
      expect.objectContaining({ _id: first, body: 'gather-gast', pinned: true }),
    ])
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

describe('searching notes', () => {
  type Harness = Awaited<ReturnType<typeof seed>>['t']
  async function addNote(t: Harness, title: string, body = '') {
    await t
      .withIdentity(alice)
      .mutation(api.notes.create, { groupSlug: 'notes-first', title, body })
  }
  async function titles(t: Harness, query: string, groupSlug = 'notes-first') {
    const found = await t
      .withIdentity(alice)
      .query(api.notes.searchNotes, { groupSlug, query })
    return found.map((note) => note.title)
  }

  test('never returns a note from another Group, even to a Member of both', async () => {
    const { t } = await seed()
    // "note" is in both titles and "household" in both bodies.
    for (const query of ['note', 'household']) {
      expect(await titles(t, query)).toEqual(['First note'])
      expect(await titles(t, query, 'notes-second')).toEqual(['Second note'])
    }
  })

  test("another Group's matches cannot crowd this Group's out", async () => {
    const { t } = await seed()
    await t.run(async (ctx) => {
      const other = await ctx.db
        .query('groups')
        .withIndex('by_slug', (q) => q.eq('slug', 'notes-second'))
        .unique()
      const user = await ctx.db.query('users').first()
      for (let index = 0; index < 150; index += 1)
        await ctx.db.insert('notes', {
          groupId: other!._id,
          title: `Boiler ${index}`,
          body: 'boiler',
          createdBy: user!._id,
          updatedAt: 1,
        })
    })
    await addNote(t, 'Boiler manual')
    expect(await titles(t, 'boiler')).toEqual(['Boiler manual'])
  })

  test('refuses a non-member, a signed-out caller and an unknown Group', async () => {
    const { t } = await seed()
    const args = { groupSlug: 'notes-first', query: 'note' }
    await expect(
      t.withIdentity(bob).query(api.notes.searchNotes, args),
    ).rejects.toThrow(/Not a member/)
    await expect(t.query(api.notes.searchNotes, args)).rejects.toThrow(
      /not-signed-in/,
    )
    await expect(
      t
        .withIdentity(alice)
        .query(api.notes.searchNotes, { ...args, groupSlug: 'nowhere' }),
    ).rejects.toThrow(/No group/)
  })

  test('every word must match, in the title, the body or across the two', async () => {
    const { t } = await seed()
    await addNote(t, 'Boiler manual', 'Call Piet')
    await addNote(t, 'Wine list', 'Piet likes red')
    expect(await titles(t, 'boiler piet')).toEqual(['Boiler manual'])
    expect(await titles(t, 'PIET')).toEqual(['Boiler manual', 'Wine list'])
    expect(await titles(t, 'boiler red')).toEqual([])
  })

  test('completes the word being typed, ignores punctuation, and needs two characters', async () => {
    const { t } = await seed()
    await addNote(t, 'Boiler manual', '\n  Call Piet\nthen wait')
    expect(await titles(t, 'boil')).toEqual(['Boiler manual'])
    expect(await titles(t, '"boiler"')).toEqual(['Boiler manual'])
    expect(await titles(t, 'b')).toEqual([])
    expect(await titles(t, '--')).toEqual([])
    const [found] = await t.withIdentity(alice).query(api.notes.searchNotes, {
      groupSlug: 'notes-first',
      query: 'boiler',
    })
    expect(found).toMatchObject({
      body: '\n  Call Piet\nthen wait',
      excerpt: 'Call Piet',
      pinned: false,
      updatedByName: 'Alice',
    })
  })

  test('a word is found inside a longer one, whole words and prefixes first', async () => {
    const { t } = await seed()
    await addNote(t, 'Boilerplate manual')
    await addNote(t, 'Boiler manual')
    expect(await titles(t, 'boiler manu')).toEqual([
      'Boiler manual',
      'Boilerplate manual',
    ])
    await addNote(t, 'Wijnkaart', 'rood')
    await addNote(t, 'Kaart', 'wijn')
    await addNote(t, 'Lunch', 'de wijnkaart van Piet')
    expect(await titles(t, 'kaart')).toEqual(
      expect.arrayContaining(['Wijnkaart', 'Kaart', 'Lunch']),
    )
    expect((await titles(t, 'kaart'))[0]).toBe('Kaart')
    expect(await titles(t, 'wijn kaart')).toEqual(
      expect.arrayContaining(['Wijnkaart', 'Kaart', 'Lunch']),
    )
    expect(await titles(t, 'kaart rood')).toEqual(['Wijnkaart'])
  })

  test('finds words with combining marks whole, in Thai and Hindi', async () => {
    const { t } = await seed()
    await addNote(t, 'Talen', 'Zij spreekt ภาษาไทย en हिन्दी')
    await addNote(t, 'Other', 'nothing here')
    expect(await titles(t, 'ภาษาไทย')).toEqual(['Talen'])
    expect(await titles(t, 'हिन्दी')).toEqual(['Talen'])
    expect(await titles(t, 'spreekt हिन्दी')).toEqual(['Talen'])
  })

  test('finds long words, words past the sixteenth and symbol-only searches', async () => {
    const { t } = await seed()
    const long = 'x'.repeat(40)
    await addNote(t, 'Long', `see ${long}`)
    await addNote(t, 'Smile', 'a 😀 b')
    await addNote(t, 'Dash', 'a -- b')
    expect(await titles(t, long)).toEqual(['Long'])
    expect(await titles(t, `see ${long.slice(5)}`)).toEqual(['Long'])
    expect(await titles(t, '😀')).toEqual(['Smile'])
    expect(await titles(t, '--')).toEqual(['Dash'])
    await addNote(t, 'Many', 'a1 a2 a3 a4 a5 a6 a7 a8 a9 b1 b2 b3 b4 b5 b6 b7 b8 end')
    expect(
      await titles(t, 'a1 a2 a3 a4 a5 a6 a7 a8 a9 b1 b2 b3 b4 b5 b6 b7 b8 end'),
    ).toEqual(['Many'])
  })

  test('reads a bounded set: an old note is found by whole word, not inside one', async () => {
    const { t } = await seed()
    await t.run(async (ctx) => {
      const group = await ctx.db
        .query('groups')
        .withIndex('by_slug', (q) => q.eq('slug', 'notes-first'))
        .unique()
      const user = await ctx.db.query('users').first()
      const note = { groupId: group!._id, createdBy: user!._id }
      await ctx.db.insert('notes', {
        ...note,
        title: 'Old whole',
        body: 'kaart',
        updatedAt: 1,
      })
      await ctx.db.insert('notes', {
        ...note,
        title: 'Old inside',
        body: 'wijnkaart',
        updatedAt: 1,
      })
      for (let index = 0; index < 150; index += 1)
        await ctx.db.insert('notes', {
          ...note,
          title: `Filler ${index}`,
          body: '',
          updatedAt: 1000 + index,
        })
    })
    expect(await titles(t, 'kaart')).toEqual(['Old whole'])
  })

  test('finds letters that change length when lowercased, and ignores words too long to index', async () => {
    const { t } = await seed()
    await addNote(t, 'İstanbul')
    expect(await titles(t, 'İstanbul')).toEqual(['İstanbul'])
    expect(await titles(t, `${'x'.repeat(40)} İstanbul`)).toEqual(['İstanbul'])
    expect(await titles(t, 'x'.repeat(40))).toEqual([])
    // 24 bytes as written, over 31 once lowercased.
    await addNote(t, 'İ'.repeat(12))
    expect(await titles(t, 'İ'.repeat(12))).toEqual(['İ'.repeat(12)])
    await addNote(t, 'ΟΣ:Α')
    expect(await titles(t, 'οσ')).toEqual(['ΟΣ:Α'])
  })

  test('a search with more words than Convex allows is cut, not refused', async () => {
    const { t } = await seed()
    await addNote(t, 'Boiler manual')
    expect(await titles(t, 'boiler '.repeat(40))).toEqual(['Boiler manual'])
  })
})

describe('the paged notes list', () => {
  type Harness = Awaited<ReturnType<typeof seed>>['t']
  /** Notes 1..count, changed in that order; every one named in `pinned` is. */
  async function addNotes(t: Harness, count: number, pinned: number[] = []) {
    return await t.run(async (ctx) => {
      const group = await ctx.db
        .query('groups')
        .withIndex('by_slug', (q) => q.eq('slug', 'notes-first'))
        .unique()
      const user = await ctx.db.query('users').first()
      const ids = []
      for (let index = 1; index <= count; index += 1)
        ids.push(
          await ctx.db.insert('notes', {
            groupId: group!._id,
            title: `Note ${index}`,
            body: `Body ${index}`,
            ...(pinned.includes(index) ? { pinned: true } : {}),
            createdBy: user!._id,
            updatedAt: 100 + index,
          }),
        )
      return ids
    })
  }
  async function page(
    t: Harness,
    numItems: number,
    cursor: string | null = null,
    unpinnedOnly?: boolean,
  ) {
    const result = await t.withIdentity(alice).query(api.notes.listPage, {
      groupSlug: 'notes-first',
      ...(unpinnedOnly ? { unpinnedOnly } : {}),
      paginationOpts: { numItems, cursor },
    })
    return { ...result, titles: result.page.map((note) => note.title) }
  }

  test('answers the newest first, then the next page from its cursor', async () => {
    const { t } = await seed()
    await addNotes(t, 4)
    const first = await page(t, 3)
    expect(first.titles).toEqual(['Note 4', 'Note 3', 'Note 2'])
    expect(first.isDone).toBe(false)
    expect(first.page[0]).toEqual({
      _id: expect.any(String),
      title: 'Note 4',
      body: 'Body 4',
      pinned: false,
      updatedAt: 104,
      updatedByName: 'Alice',
      updatedByMe: true,
    })
    const second = await page(t, 3, first.continueCursor)
    expect(second.titles).toEqual(['Note 1', 'First note'])
    expect(second.isDone).toBe(true)
  })

  test('an edited note moves to the front', async () => {
    const { t } = await seed()
    const [oldest] = await addNotes(t, 3)
    await t.withIdentity(alice).mutation(api.notes.update, {
      groupSlug: 'notes-first',
      noteId: oldest,
      body: 'Changed',
    })
    expect((await page(t, 2)).titles).toEqual(['Note 1', 'Note 3'])
  })

  test('pinned notes are listed apart, however old, and leave full pages', async () => {
    const { t } = await seed()
    await addNotes(t, 4, [1, 3])
    const pinned = await t
      .withIdentity(alice)
      .query(api.notes.listPinned, { groupSlug: 'notes-first' })
    expect(pinned.map((note) => note.title)).toEqual([
      'Note 3',
      'Note 1',
      'First note',
    ])
    expect((await page(t, 2, null, true)).titles).toEqual(['Note 4', 'Note 2'])
  })

  test('get answers one note, and null for a missing, foreign or malformed id', async () => {
    const { t, firstNote } = await seed()
    const get = (groupSlug: string, noteId: string) =>
      t.withIdentity(alice).query(api.notes.get, { groupSlug, noteId })
    expect(await get('notes-first', firstNote)).toMatchObject({
      _id: firstNote,
      title: 'First note',
      pinned: true,
    })
    // Alice is in both Groups; the note is only in the first.
    expect(await get('notes-second', firstNote)).toBeNull()
    expect(await get('notes-first', 'nonsense')).toBeNull()
    await t.withIdentity(alice).mutation(api.notes.remove, {
      groupSlug: 'notes-first',
      noteId: firstNote,
    })
    expect(await get('notes-first', firstNote)).toBeNull()
  })

  test("the picker offers this Group's 50 most recently changed notes", async () => {
    const { t } = await seed()
    await addNotes(t, 60)
    const notes = await t
      .withIdentity(alice)
      .query(api.notes.picker, { groupSlug: 'notes-first' })
    expect(notes).toHaveLength(50)
    expect(notes[0]).toEqual({
      _id: expect.any(String),
      title: 'Note 60',
      body: 'Body 60',
    })
    expect(notes[49].title).toBe('Note 11')
  })

  test('every read refuses a non-member and a signed-out caller', async () => {
    const { t, firstNote } = await seed()
    const args = { groupSlug: 'notes-first' }
    const paginationOpts = { numItems: 5, cursor: null }
    const stranger = t.withIdentity(bob)
    for (const [caller, refusal] of [
      [stranger, /Not a member/],
      [t, /not-signed-in/],
    ] as const) {
      for (const read of [
        () => caller.query(api.notes.listPage, { ...args, paginationOpts }),
        () => caller.query(api.notes.listPinned, args),
        () => caller.query(api.notes.get, { ...args, noteId: firstNote }),
        () => caller.query(api.notes.get, { ...args, noteId: 'nonsense' }),
        () => caller.query(api.notes.picker, args),
      ])
        await expect(read()).rejects.toThrow(refusal)
    }
  })
})
