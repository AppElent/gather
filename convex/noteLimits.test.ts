/**
 * A note's most characters, and reads of whole notes that stay inside a
 * query's 16 MiB (APP-805). The backend here refuses what Convex would.
 */
import { NOTE_MAX_CHARS } from '@gather/core/notes'
import type { PaginationResult } from 'convex/server'
import { ConvexError, getDocumentSize } from 'convex/values'
import { describe, expect, test, vi } from 'vitest'
import {
  alice,
  seedGroup,
  seedMember,
  testConvexWithLimits,
} from '../test/convexHarness'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { noteSearchText } from './lib/noteSearch'

const groupSlug = 'note-limits'
/** Three bytes in UTF-8, so a note of these is as large as one gets. */
const WIDE = '語'

async function seed() {
  const t = testConvexWithLimits()
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', {
      clerkId: alice.subject,
      name: alice.name,
      email: alice.email,
    })
    const groupId = await seedGroup(ctx, { name: 'Home', slug: groupSlug })
    await seedMember(ctx, groupId, userId, 'admin')
    return { userId, groupId }
  })
  /** Straight into the table, past the limit, as older notes got there. */
  const add = (
    note: { title: string; body: string; pinned?: boolean; updatedAt?: number },
    { filled = false } = {},
  ) =>
    t.run((ctx) =>
      ctx.db.insert('notes', {
        groupId: ids.groupId,
        createdBy: ids.userId,
        updatedAt: 1,
        ...note,
        ...(filled ? { searchText: noteSearchText(note) } : {}),
      }),
    )
  const stored = (id: Id<'notes'>) => t.run((ctx) => ctx.db.get(id))
  return { t, me: t.withIdentity(alice), add, stored, ...ids }
}

async function kindOf(write: Promise<unknown>) {
  const error = await write.then(
    () => null,
    (caught: unknown) => caught,
  )
  if (error === null) return null
  expect(error).toBeInstanceOf(ConvexError)
  const { data } = error as ConvexError<string | { kind: string }>
  return (typeof data === 'string' ? JSON.parse(data) : data).kind as string
}

const TOO_LONG = 'notes:too-long'

describe('the most a note holds', () => {
  test('create takes title and body of 100,000 characters, and no more', async () => {
    const { t, me } = await seed()
    const body = WIDE.repeat(NOTE_MAX_CHARS - 4)
    const idempotencyKey = '6f1f2a44-7c0a-4a53-9a3e-0d5c0e0a7011'
    const create = (title: string) =>
      me.mutation(api.notes.create, { groupSlug, title, body, idempotencyKey })
    expect(await kindOf(create('12345'))).toBe(TOO_LONG)
    // Nothing written: no note, and the key is still free.
    expect(
      await t.run(async (ctx) => [
        ...(await ctx.db.query('notes').collect()),
        ...(await ctx.db.query('idempotencyKeys').collect()),
      ]),
    ).toEqual([])
    expect(await kindOf(create('1234'))).toBe(null)
  })

  test('update refuses a title or body that makes it too long, and writes nothing', async () => {
    const { me, stored } = await seed()
    const noteId = await me.mutation(api.notes.create, {
      groupSlug,
      title: 'x',
      body: 'a'.repeat(NOTE_MAX_CHARS - 1),
    })
    const before = await stored(noteId)
    for (const patch of [
      { title: 'xy' },
      { body: 'a'.repeat(NOTE_MAX_CHARS) },
      { title: 'xy', pinned: true },
    ])
      expect(
        await kindOf(
          me.mutation(api.notes.update, { groupSlug, noteId, ...patch }),
        ),
      ).toBe(TOO_LONG)
    expect(await stored(noteId)).toEqual(before)
  })

  test.each([
    ['filled', 150_000, true],
    ['too large to hold twice', 900_000, false],
  ])('a note over the limit (%s) opens, pins, shrinks and is deleted', async (_, size, filled) => {
    const { me, add, stored } = await seed()
    const body = 'a'.repeat(size)
    const noteId = await add({ title: 'Old', body }, { filled })
    const update = (patch: { title?: string; body?: string; pinned?: boolean }) =>
      me.mutation(api.notes.update, { groupSlug, noteId, ...patch })
    expect(await me.query(api.notes.get, { groupSlug, noteId })).toMatchObject({
      body,
    })
    await update({ pinned: true })
    // Saving the same text with the pin is not an edit either.
    await update({ title: 'Old', body, pinned: true })
    expect(await stored(noteId)).toMatchObject({ pinned: true, updatedAt: 1 })
    await update({ pinned: false })

    expect(await kindOf(update({ title: 'O' }))).toBe(TOO_LONG)
    expect(await kindOf(update({ body: 'a'.repeat(size - 1) }))).toBe(TOO_LONG)
    expect(await stored(noteId)).toMatchObject({ title: 'Old', body })

    await update({ body: 'short' })
    expect(await stored(noteId)).toMatchObject({
      body: 'short',
      searchText: 'Old\nshort',
    })
    await me.mutation(api.notes.remove, { groupSlug, noteId })
    expect(await stored(noteId)).toBe(null)
  })

  test('a note over the limit can be deleted as it is', async () => {
    const { me, add, stored } = await seed()
    const noteId = await add({ title: 'Old', body: 'a'.repeat(900_000) })
    await me.mutation(api.notes.remove, { groupSlug, noteId })
    expect(await stored(noteId)).toBe(null)
  })
})

describe('reads of a Group full of the longest notes', () => {
  const NOTES = 60
  async function full({ filled = true, pinned = () => false } = {} as {
    filled?: boolean
    pinned?: (index: number) => boolean
  }) {
    const seeded = await seed()
    const body = `kaart ${WIDE.repeat(NOTE_MAX_CHARS - 20)}`
    for (let index = 0; index < NOTES; index += 1)
      await seeded.add(
        {
          title: `Kaart ${index}`,
          body,
          pinned: pinned(index),
          updatedAt: index,
        },
        { filled },
      )
    return seeded
  }

  test('the seed is more than any one read may take', async () => {
    const { t } = await full()
    await expect(
      t.run(async (ctx) => (await ctx.db.query('notes').collect()).length),
    ).rejects.toThrow(/Read too much data/)
  })

  test.each([true, false])('list, listPinned, picker and search (filled: %s)', async (filled) => {
    const { me } = await full({ filled, pinned: () => true })
    for (const read of [
      () => me.query(api.notes.list, { groupSlug }),
      () => me.query(api.notes.listPinned, { groupSlug }),
      () => me.query(api.notes.picker, { groupSlug }),
      () => me.query(api.notes.searchNotes, { groupSlug, query: 'kaart' }),
      () => me.query(api.notes.searchNotes, { groupSlug, query: 'aart 語' }),
      () => me.query(api.search.group, { groupSlug, query: 'kaart' }),
    ])
      expect((await read()).length).toBeGreaterThan(0)
    const newest = await me.query(api.notes.list, { groupSlug })
    expect(newest[0].title).toBe(`Kaart ${NOTES - 1}`)
  })

  test.each([
    ['every note', {}, NOTES],
    ['the unpinned', { unpinnedOnly: true }, NOTES - 2],
    // The two oldest: past any bound of the one-shot listPinned.
    ['the pinned', { pinnedOnly: true }, 2],
  ])('listPage reaches %s, a bounded page at a time', async (_, args, count) => {
    const { me } = await full({ pinned: (index) => index < 2 })
    const seen: string[] = []
    let cursor: string | null = null
    let pages = 0
    for (;;) {
      const result: PaginationResult<{ title: string }> = await me.query(
        api.notes.listPage,
        { groupSlug, ...args, paginationOpts: { numItems: 100, cursor } },
      )
      pages += 1
      seen.push(...result.page.map((note) => note.title))
      if (result.isDone) break
      cursor = result.continueCursor
    }
    expect(pages).toBeGreaterThan(1)
    expect(new Set(seen).size).toBe(count)
    expect(seen).toHaveLength(count)
  })

  test('a client cannot raise the bound', async () => {
    const { me } = await full()
    const result = await me.query(api.notes.listPage, {
      groupSlug,
      paginationOpts: {
        numItems: 100,
        cursor: null,
        maximumBytesRead: 1024 ** 3,
      },
    })
    expect(result.page.length).toBeLessThan(20)
    expect(result.isDone).toBe(false)
  })
})

test('search reads notes of 1 MiB, from before the limit', async () => {
  const { me, add } = await seed()
  for (let index = 0; index < 30; index += 1)
    await add({
      title: `Kaart ${index}`,
      body: 'a'.repeat(1_040_000),
      updatedAt: index,
    })
  for (const query of ['kaart', 'aart'])
    expect(
      (await me.query(api.notes.searchNotes, { groupSlug, query })).length,
    ).toBeGreaterThan(0)
  expect(
    (await me.query(api.notes.listPinned, { groupSlug })).length,
  ).toBe(0)
})

describe('migrations:backfillNoteSearchText', () => {
  const backfill = internal.migrations.backfillNoteSearchText

  test('names a note it cannot fill, and fills the rest of the page', async () => {
    const { t, add, stored } = await seed()
    const small = await add({ title: 'Small', body: 'x' })
    const large = await add({ title: 'Large', body: 'a'.repeat(600_000) })
    const over = await add({ title: 'Over', body: 'a'.repeat(150_000) })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const dry = { scanned: 3, missing: 2, unfillable: [large], more: false }
    expect(await t.mutation(backfill, {})).toMatchObject(dry)
    expect(await t.mutation(backfill, { apply: true })).toMatchObject(dry)
    expect(log).toHaveBeenLastCalledWith(expect.stringContaining(large))
    log.mockRestore()
    expect((await stored(small))?.searchText).toBe('Small\nx')
    expect((await stored(over))?.searchText).toHaveLength(150_005)
    expect(await stored(large)).not.toHaveProperty('searchText')
    expect(getDocumentSize((await stored(large))!)).toBeLessThan(1024 ** 2)

    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await t.mutation(backfill, {})).toMatchObject({
      missing: 0,
      unfillable: [large],
    })
    vi.restoreAllMocks()
  })
})
