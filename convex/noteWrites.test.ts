/**
 * Every note write keeps `searchText` in step with title and body (APP-701).
 * The field is optional in the schema, so the compiler cannot say who forgets
 * it: each path is run here, and a new one around `lib/noteSearch.ts` fails
 * the last test.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  alice as asAlice,
  seedGroup,
  seedMember,
  testConvex,
} from '../test/convexHarness'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { applySample, ensureSeedUser } from './lib/seed/apply'

const SLUG = 'note-writes'

async function seed() {
  const t = testConvex()
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', {
      clerkId: asAlice.subject,
      name: asAlice.name,
      email: asAlice.email,
    })
    const groupId = await seedGroup(ctx, { name: 'Home', slug: SLUG })
    await seedMember(ctx, groupId, userId, 'admin')
    return { userId, groupId }
  })
  const stored = async (id: Id<'notes'>) =>
    (await t.run((ctx) => ctx.db.get(id)))?.searchText
  return { t, me: t.withIdentity(asAlice), stored, ...ids }
}

describe('a note write sets searchText', () => {
  test('notes.create, which MCP create_note and a Drop call too', async () => {
    const { me, stored } = await seed()
    const id = await me.mutation(api.notes.create, {
      groupSlug: SLUG,
      title: 'Wifi',
      body: 'hunter2',
      idempotencyKey: '6f1f2a44-7c0a-4a53-9a3e-0d5c0e0a7011',
    })
    expect(await stored(id)).toBe('Wifi\nhunter2')
  })

  test.each([
    [{ title: 'Router' }, 'Router\nhunter2'],
    [{ body: 'changed' }, 'Wifi\nchanged'],
    [{ title: 'Router', body: '' }, 'Router\n'],
    [{ pinned: true }, 'Wifi\nhunter2'],
  ])('notes.update with %j', async (patch, expected) => {
    const { me, stored } = await seed()
    const noteId = await me.mutation(api.notes.create, {
      groupSlug: SLUG,
      title: 'Wifi',
      body: 'hunter2',
    })
    await me.mutation(api.notes.update, { groupSlug: SLUG, noteId, ...patch })
    expect(await stored(noteId)).toBe(expected)
  })

  test('notes.update on a note the backfill has not reached', async () => {
    const { t, me, stored, groupId, userId } = await seed()
    const noteId = await t.run((ctx) =>
      ctx.db.insert('notes', {
        groupId,
        title: 'Wifi',
        body: 'hunter2',
        createdBy: userId,
        updatedAt: 1,
      }),
    )
    await me.mutation(api.notes.update, {
      groupSlug: SLUG,
      noteId,
      body: 'changed',
    })
    expect(await stored(noteId)).toBe('Wifi\nchanged')
  })

  test('the Sample household', async () => {
    const t = testConvex()
    const notes = await t.run(async (ctx) => {
      const owner = await ensureSeedUser(ctx, 'clerk_o', 'Owner', 'o@example.test')
      await applySample(ctx, owner, Date.now())
      return await ctx.db.query('notes').collect()
    })
    expect(notes.length).toBeGreaterThan(0)
    for (const note of notes)
      expect(note.searchText).toBe(`${note.title}\n${note.body}`)
  })

  test('only lib/noteSearch.ts and the backfill write a note', () => {
    const root = path.dirname(new URL(import.meta.url).pathname)
    const sources = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory())
          return entry.name === '_generated' ? [] : sources(full)
        return /\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)
          ? [full]
          : []
      })
    // An insert names the table; a patch or replace names the note's id, which
    // every caller calls a note (`args.noteId`, `note._id`).
    const write =
      /\.insert\(\s*['"]notes['"]|\.(patch|replace)\(\s*(['"]notes['"]|[\w.!]*note(Id)?\b)/i
    const writers = sources(root)
      .filter((file) => write.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(root, file))
    expect(writers.sort()).toEqual(['lib/noteSearch.ts', 'migrations.ts'])
  })
})

test('the deprecated notes.list does not answer searchText', async () => {
  const { me } = await seed()
  await me.mutation(api.notes.create, { groupSlug: SLUG, title: 'a', body: 'b' })
  const [note] = await me.query(api.notes.list, { groupSlug: SLUG })
  expect(note).toMatchObject({ title: 'a', body: 'b' })
  expect(note).not.toHaveProperty('searchText')
})

describe('migrations:backfillNoteSearchText', () => {
  const backfill = internal.migrations.backfillNoteSearchText

  async function legacyNotes(count: number) {
    const seeded = await seed()
    await seeded.t.run(async (ctx) => {
      for (let index = 0; index < count; index += 1)
        await ctx.db.insert('notes', {
          groupId: seeded.groupId,
          title: `Note ${index}`,
          body: `Body ${index}`,
          createdBy: seeded.userId,
          updatedAt: index,
        })
    })
    const all = () => seeded.t.run((ctx) => ctx.db.query('notes').collect())
    return { t: seeded.t, all }
  }

  test('changes nothing in a dry run', async () => {
    const { t, all } = await legacyNotes(3)
    const before = await all()
    expect(await t.mutation(backfill, {})).toMatchObject({
      apply: false,
      scanned: 3,
      missing: 3,
      more: false,
    })
    expect(await all()).toEqual(before)
  })

  test('resumes from its cursor, a bounded page per call, and only adds the field', async () => {
    const { t, all } = await legacyNotes(5)
    const before = await all()
    let cursor: string | null = null
    const pages: number[] = []
    for (;;) {
      const result: { scanned: number; more: boolean; cursor: string } =
        await t.mutation(backfill, { apply: true, cursor, batch: 2 })
      pages.push(result.scanned)
      cursor = result.cursor
      if (!result.more) break
      if (pages.length === 1)
        expect((await all()).filter((note) => note.searchText)).toHaveLength(2)
    }
    expect(pages.slice(0, 3)).toEqual([2, 2, 1])
    expect(await all()).toEqual(
      before.map((note) => ({
        ...note,
        searchText: `${note.title}\n${note.body}`,
      })),
    )
  })

  test('is idempotent, and puts right a searchText out of step', async () => {
    const { t, all } = await legacyNotes(2)
    await t.mutation(backfill, { apply: true })
    const once = await all()
    expect(await t.mutation(backfill, { apply: true })).toMatchObject({
      scanned: 2,
      missing: 0,
    })
    expect(await all()).toEqual(once)

    await t.run((ctx) => ctx.db.patch(once[0]._id, { searchText: 'stale' }))
    expect(await t.mutation(backfill, { apply: true })).toMatchObject({
      missing: 1,
    })
    expect(await all()).toEqual(once)
  })

  test('caps the batch', async () => {
    const { t } = await legacyNotes(101)
    expect(await t.mutation(backfill, { batch: 1000 })).toMatchObject({
      scanned: 100,
      more: true,
    })
  })
})
