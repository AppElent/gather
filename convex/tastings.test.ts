import { describe, expect, test } from 'vitest'
import { testConvex } from '../test/convexHarness'
import { api, internal } from './_generated/api'

/**
 * The tasting Modules, through the functions a client really calls.
 *
 * Everything here goes in through a real query or mutation with a real
 * identity, so what is asserted is what a caller gets back — never which rows
 * were written or which helper ran. The three things worth this seam are the
 * ones a type cannot state: that a subject *materialises exactly once*, that
 * Attribution decides who may edit and does not decide who may delete, and
 * that a payload the form would never send is refused at the door.
 */

const alice = { subject: 'clerk_alice', name: 'Alice', email: 'a@example.com' }
const bob = { subject: 'clerk_bob', name: 'Bob', email: 'b@example.com' }
const carol = { subject: 'clerk_carol', name: 'Carol', email: 'c@example.com' }

/**
 * Two households. Alice and Bob share the first; Carol is only in the second —
 * so "a Member's Tasting", "another Member's Tasting" and "not your Group at
 * all" are three genuinely different callers.
 */
async function seed() {
  const t = testConvex()

  await t.run(async (ctx) => {
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
    const carolId = await ctx.db.insert('users', {
      clerkId: carol.subject,
      name: carol.name,
      email: carol.email,
    })

    const club = await ctx.db.insert('groups', {
      name: 'Wine Club',
      slug: 'wine-club',
      isPersonal: false,
      inviteCode: 'club',
    })
    const other = await ctx.db.insert('groups', {
      name: 'Other House',
      slug: 'other-house',
      isPersonal: false,
      inviteCode: 'other',
    })

    await ctx.db.insert('memberships', {
      groupId: club,
      userId: aliceId,
      role: 'admin',
    })
    await ctx.db.insert('memberships', {
      groupId: club,
      userId: bobId,
      role: 'member',
    })
    await ctx.db.insert('memberships', {
      groupId: other,
      userId: carolId,
      role: 'admin',
    })
  })

  // The real catalog, reconciled the way a deploy reconciles it — so the
  // picker's entries and the seed's fixtures are the same rows the app has.
  await t.mutation(internal.seed.seedTastingCatalog, {})

  return t
}

const CLUB = { groupSlug: 'wine-club' } as const

describe('logging a Tasting', () => {
  test('a catalog entry materialises exactly one subject, prefilled', async () => {
    const t = await seed()

    const { subjectId } = await t
      .withIdentity(alice)
      .mutation(api.tastings.logTasting, {
        ...CLUB,
        kind: 'cheese',
        subject: {
          name: 'Comté',
          catalogKey: 'cheese-comte',
          attributes: { milk: 'cow', country: 'france', style: 'hard' },
        },
        rating: 4.5,
        tastedAt: '2026-08-22',
      })

    const subjects = await t
      .withIdentity(alice)
      .query(api.tastings.listByKind, { ...CLUB, kind: 'cheese' })

    expect(subjects).toHaveLength(1)
    expect(subjects[0]._id).toBe(subjectId)
    expect(subjects[0].name).toBe('Comté')
    expect(subjects[0].catalogKey).toBe('cheese-comte')
    expect(subjects[0].attributes).toEqual({
      milk: 'cow',
      country: 'france',
      style: 'hard',
    })
  })

  test('the same catalog entry twice is one subject and two Tastings', async () => {
    const t = await seed()
    const entry = {
      ...CLUB,
      kind: 'cheese',
      subject: { name: 'Comté', catalogKey: 'cheese-comte' },
      tastedAt: '2026-08-22',
    } as const

    const first = await t
      .withIdentity(alice)
      .mutation(api.tastings.logTasting, { ...entry, rating: 4.5 })
    const second = await t
      .withIdentity(bob)
      .mutation(api.tastings.logTasting, { ...entry, rating: 3 })

    expect(second.subjectId).toBe(first.subjectId)
    expect(second.tastingId).not.toBe(first.tastingId)

    const page = await t
      .withIdentity(alice)
      .query(api.tastings.getSubject, { ...CLUB, id: first.subjectId })
    expect(page?.tastings).toHaveLength(2)
    // The average is the household's, and it never appears without its count.
    expect(page?.subject.average).toBe(3.8)
    expect(page?.subject.count).toBe(2)
  })

  test('a hand-typed name never collides with a catalog key', async () => {
    const t = await seed()

    const typed = await t
      .withIdentity(alice)
      .mutation(api.tastings.logTasting, {
        ...CLUB,
        kind: 'cheese',
        subject: { name: 'Gouda' },
        rating: 3,
        tastedAt: '2026-08-20',
      })
    const chosen = await t
      .withIdentity(alice)
      .mutation(api.tastings.logTasting, {
        ...CLUB,
        kind: 'cheese',
        subject: { name: 'Gouda', catalogKey: 'cheese-gouda' },
        rating: 4,
        tastedAt: '2026-08-21',
      })

    // Two Goudas, deliberately: a warning in the picker is the answer to that
    // (story 5), never a silent merge here.
    expect(chosen.subjectId).not.toBe(typed.subjectId)
    const subjects = await t
      .withIdentity(alice)
      .query(api.tastings.listByKind, { ...CLUB, kind: 'cheese' })
    expect(subjects).toHaveLength(2)
    expect(subjects.filter((s) => s.catalogKey === undefined)).toHaveLength(1)
  })

  test('refuses a catalog key that is not shipped', async () => {
    const t = await seed()

    await expect(
      t.withIdentity(alice).mutation(api.tastings.logTasting, {
        ...CLUB,
        kind: 'cheese',
        subject: { name: 'Invented', catalogKey: 'cheese-invented' },
        rating: 3,
        tastedAt: '2026-08-20',
      }),
    ).rejects.toThrow()
  })

  test('two Members’ Tastings both survive, each attributed', async () => {
    const t = await seed()
    const { subjectId } = await t
      .withIdentity(alice)
      .mutation(api.tastings.logTasting, {
        ...CLUB,
        kind: 'wine',
        subject: { name: 'Vajra Barolo 2019', attributes: { vintage: 2019 } },
        rating: 4.5,
        tastedAt: '2026-08-22',
      })
    await t.withIdentity(bob).mutation(api.tastings.logTasting, {
      ...CLUB,
      kind: 'wine',
      subject: { subjectId },
      rating: 3.5,
      tastedAt: '2026-08-22',
    })

    const forAlice = await t
      .withIdentity(alice)
      .query(api.tastings.getSubject, { ...CLUB, id: subjectId })
    expect(forAlice?.tastings.map((row) => row.byName).sort()).toEqual([
      'Alice',
      'Bob',
    ])
    // `mine` is the reader's own answer, so the same rows read differently for
    // the two of them — which is what gates Edit on the row.
    expect(forAlice?.tastings.filter((row) => row.mine)).toHaveLength(1)

    const forBob = await t
      .withIdentity(bob)
      .query(api.tastings.getSubject, { ...CLUB, id: subjectId })
    expect(forBob?.tastings.find((row) => row.mine)?.rating).toBe(3.5)
  })

  test('keeps tastedAt, and keeps it independent of when it was typed', async () => {
    const t = await seed()
    const { subjectId, tastingId } = await t
      .withIdentity(alice)
      .mutation(api.tastings.logTasting, {
        ...CLUB,
        kind: 'beer',
        subject: { name: 'Westmalle Tripel' },
        rating: 4.5,
        tastedAt: '2026-08-22',
      })

    const page = await t
      .withIdentity(alice)
      .query(api.tastings.getSubject, { ...CLUB, id: subjectId })
    expect(page?.tastings[0].tastedAt).toBe('2026-08-22')

    const row = await t.run(async (ctx) => await ctx.db.get(tastingId))
    // Logged now, tasted on the 22nd — the two are different numbers and the
    // stream and the page order by different ones (story 12).
    expect(row?._creationTime).toBeGreaterThan(new Date('2026-08-22').getTime())
  })

  test('refuses a score that is not a half step between 1 and 5', async () => {
    const t = await seed()
    for (const rating of [0, 4.3, 5.5]) {
      await expect(
        t.withIdentity(alice).mutation(api.tastings.logTasting, {
          ...CLUB,
          kind: 'beer',
          subject: { name: 'Duvel' },
          rating,
          tastedAt: '2026-08-22',
        }),
      ).rejects.toThrow()
    }
  })

  test('refuses a subject with no name at all', async () => {
    const t = await seed()
    await expect(
      t.withIdentity(alice).mutation(api.tastings.logTasting, {
        ...CLUB,
        kind: 'beer',
        subject: { name: '   ' },
        rating: 4,
        tastedAt: '2026-08-22',
      }),
    ).rejects.toThrow()
  })
})

describe('attributes are checked against the Kind spec', () => {
  test('refuses a field the Kind does not declare', async () => {
    const t = await seed()
    await expect(
      t.withIdentity(alice).mutation(api.tastings.logTasting, {
        ...CLUB,
        kind: 'beer',
        subject: { name: 'Duvel', attributes: { vintage: 2019 } },
        rating: 4,
        tastedAt: '2026-08-22',
      }),
    ).rejects.toThrow()
  })

  test('refuses a term outside a select’s vocabulary', async () => {
    const t = await seed()
    await expect(
      t.withIdentity(alice).mutation(api.tastings.logTasting, {
        ...CLUB,
        kind: 'cheese',
        subject: { name: 'Yak cheese', attributes: { milk: 'yak' } },
        rating: 4,
        tastedAt: '2026-08-22',
      }),
    ).rejects.toThrow()
  })

  test('accepts a tag outside the vocabulary — it is a prompt', async () => {
    const t = await seed()
    const { subjectId } = await t
      .withIdentity(alice)
      .mutation(api.tastings.logTasting, {
        ...CLUB,
        kind: 'wine',
        subject: { name: 'Some Riesling' },
        rating: 4,
        tastedAt: '2026-08-22',
        attributes: { aromas: ['citrus', 'wet slate'] },
      })

    const page = await t
      .withIdentity(alice)
      .query(api.tastings.getSubject, { ...CLUB, id: subjectId })
    expect(page?.tastings[0].attributes.aromas).toEqual(['citrus', 'wet slate'])
  })

  test('an impression sent as a fact is refused, and the reverse', async () => {
    const t = await seed()
    await expect(
      t.withIdentity(alice).mutation(api.tastings.logTasting, {
        ...CLUB,
        kind: 'wine',
        subject: { name: 'Barolo', attributes: { tannin: 4 } },
        rating: 4,
        tastedAt: '2026-08-22',
      }),
    ).rejects.toThrow()
    await expect(
      t.withIdentity(alice).mutation(api.tastings.logTasting, {
        ...CLUB,
        kind: 'wine',
        subject: { name: 'Barolo' },
        rating: 4,
        tastedAt: '2026-08-22',
        attributes: { vintage: 2019 },
      }),
    ).rejects.toThrow()
  })

  test('drops what the form left blank instead of storing it', async () => {
    const t = await seed()
    const { subjectId } = await t
      .withIdentity(alice)
      .mutation(api.tastings.logTasting, {
        ...CLUB,
        kind: 'cheese',
        subject: {
          name: '  Brie  ',
          attributes: { producer: '', milk: 'cow' },
        },
        rating: 4,
        tastedAt: '2026-08-22',
        attributes: { notes: '   ', aromas: [] },
      })

    const page = await t
      .withIdentity(alice)
      .query(api.tastings.getSubject, { ...CLUB, id: subjectId })
    expect(page?.subject.name).toBe('Brie')
    expect(page?.subject.attributes).toEqual({ milk: 'cow' })
    expect(page?.tastings[0].attributes).toEqual({})
  })

  test('refuses a date that is not a plain day', async () => {
    const t = await seed()
    await expect(
      t.withIdentity(alice).mutation(api.tastings.logTasting, {
        ...CLUB,
        kind: 'beer',
        subject: { name: 'Duvel' },
        rating: 4,
        tastedAt: '2026-08-22T19:00:00Z',
      }),
    ).rejects.toThrow()
  })
})

describe('who may change what', () => {
  async function withTwoTastings() {
    const t = await seed()
    const mine = await t.withIdentity(alice).mutation(api.tastings.logTasting, {
      ...CLUB,
      kind: 'wine',
      subject: { name: 'Vajra Barolo 2019' },
      rating: 4.5,
      tastedAt: '2026-08-22',
    })
    const theirs = await t.withIdentity(bob).mutation(api.tastings.logTasting, {
      ...CLUB,
      kind: 'wine',
      subject: { subjectId: mine.subjectId },
      rating: 3,
      tastedAt: '2026-08-22',
    })
    return { t, subjectId: mine.subjectId, mine, theirs }
  }

  test('the author may correct their own', async () => {
    const { t, subjectId, mine } = await withTwoTastings()

    await t.withIdentity(alice).mutation(api.tastings.updateTasting, {
      ...CLUB,
      id: mine.tastingId,
      rating: 4,
      tastedAt: '2026-08-21',
      attributes: { tannin: 5 },
    })

    const page = await t
      .withIdentity(alice)
      .query(api.tastings.getSubject, { ...CLUB, id: subjectId })
    const row = page?.tastings.find((entry) => entry._id === mine.tastingId)
    expect(row?.rating).toBe(4)
    expect(row?.tastedAt).toBe('2026-08-21')
    expect(row?.attributes).toEqual({ tannin: 5 })
  })

  test('another Member may not — that would be words in their mouth', async () => {
    const { t, theirs } = await withTwoTastings()

    await expect(
      t.withIdentity(alice).mutation(api.tastings.updateTasting, {
        ...CLUB,
        id: theirs.tastingId,
        rating: 1,
        tastedAt: '2026-08-22',
      }),
    ).rejects.toThrow('notYourTasting')
  })

  test('but any Member may delete any Tasting — that is tidying', async () => {
    const { t, subjectId, theirs } = await withTwoTastings()

    await t
      .withIdentity(alice)
      .mutation(api.tastings.removeTasting, { ...CLUB, id: theirs.tastingId })

    const page = await t
      .withIdentity(alice)
      .query(api.tastings.getSubject, { ...CLUB, id: subjectId })
    expect(page?.tastings).toHaveLength(1)
    // The subject stands even when a Tasting goes: it is still a bottle the
    // household has.
    expect(page?.subject.name).toBe('Vajra Barolo 2019')
  })

  test('any Member may correct the subject’s facts', async () => {
    const { t, subjectId } = await withTwoTastings()

    await t.withIdentity(bob).mutation(api.tastings.updateSubject, {
      ...CLUB,
      id: subjectId,
      name: 'Vajra Barolo 2018',
      attributes: { vintage: 2018 },
    })

    const page = await t
      .withIdentity(alice)
      .query(api.tastings.getSubject, { ...CLUB, id: subjectId })
    expect(page?.subject.name).toBe('Vajra Barolo 2018')
    expect(page?.subject.attributes).toEqual({ vintage: 2018 })
  })

  test('including one that came from the catalog, keeping its provenance', async () => {
    const t = await seed()
    const { subjectId } = await t
      .withIdentity(alice)
      .mutation(api.tastings.logTasting, {
        ...CLUB,
        kind: 'cheese',
        subject: { name: 'Comté', catalogKey: 'cheese-comte' },
        rating: 4,
        tastedAt: '2026-08-22',
      })

    await t.withIdentity(bob).mutation(api.tastings.updateSubject, {
      ...CLUB,
      id: subjectId,
      name: 'Comté 24 months',
      attributes: { milk: 'cow', age: 24 },
    })

    const page = await t
      .withIdentity(alice)
      .query(api.tastings.getSubject, { ...CLUB, id: subjectId })
    expect(page?.subject.name).toBe('Comté 24 months')
    // Corrected, not re-badged: a fixed vintage does not make it a different
    // catalog entry, so `catalogKey` is untouched and the next person choosing
    // Comté still lands on this row.
    expect(page?.subject.catalogKey).toBe('cheese-comte')
  })

  test('deleting a subject deletes its Tastings', async () => {
    const { t, subjectId } = await withTwoTastings()

    const result = await t
      .withIdentity(bob)
      .mutation(api.tastings.removeSubject, { ...CLUB, id: subjectId })

    expect(result.deletedTastings).toBe(2)
    expect(
      await t
        .withIdentity(alice)
        .query(api.tastings.getSubject, { ...CLUB, id: subjectId }),
    ).toBeNull()
    const orphans = await t.run(
      async (ctx) => await ctx.db.query('tastings').collect(),
    )
    expect(orphans).toEqual([])
  })
})

describe('the Group is the boundary', () => {
  test('somebody outside gets the Group’s single refusal', async () => {
    const t = await seed()
    const { subjectId, tastingId } = await t
      .withIdentity(alice)
      .mutation(api.tastings.logTasting, {
        ...CLUB,
        kind: 'wine',
        subject: { name: 'Vajra Barolo 2019' },
        rating: 4.5,
        tastedAt: '2026-08-22',
      })

    await expect(
      t.withIdentity(carol).query(api.tastings.listByKind, {
        ...CLUB,
        kind: 'wine',
      }),
    ).rejects.toThrow('Not a member of that group')
    await expect(
      t
        .withIdentity(carol)
        .query(api.tastings.getSubject, { ...CLUB, id: subjectId }),
    ).rejects.toThrow('Not a member of that group')
    await expect(
      t
        .withIdentity(carol)
        .mutation(api.tastings.removeTasting, { ...CLUB, id: tastingId }),
    ).rejects.toThrow('Not a member of that group')
  })

  test('a subject read at another Group’s address is simply not found', async () => {
    const t = await seed()
    const { subjectId } = await t
      .withIdentity(alice)
      .mutation(api.tastings.logTasting, {
        ...CLUB,
        kind: 'wine',
        subject: { name: 'Vajra Barolo 2019' },
        rating: 4.5,
        tastedAt: '2026-08-22',
      })

    expect(
      await t.withIdentity(carol).query(api.tastings.getSubject, {
        groupSlug: 'other-house',
        id: subjectId,
      }),
    ).toBeNull()
  })

  test('a cheese asked for as a wine is not found either', async () => {
    const t = await seed()
    const { subjectId } = await t
      .withIdentity(alice)
      .mutation(api.tastings.logTasting, {
        ...CLUB,
        kind: 'cheese',
        subject: { name: 'Comté', catalogKey: 'cheese-comte' },
        rating: 4,
        tastedAt: '2026-08-22',
      })

    // What stops `/wines/<id>` rendering a cheese.
    expect(
      await t.withIdentity(alice).query(api.tastings.getSubject, {
        ...CLUB,
        id: subjectId,
        kind: 'wine',
      }),
    ).toBeNull()
    expect(
      await t.withIdentity(alice).query(api.tastings.getSubject, {
        ...CLUB,
        id: subjectId,
        kind: 'cheese',
      }),
    ).not.toBeNull()
  })

  test('each Group’s subjects stay its own', async () => {
    const t = await seed()
    await t.withIdentity(alice).mutation(api.tastings.logTasting, {
      ...CLUB,
      kind: 'wine',
      subject: { name: 'Vajra Barolo 2019' },
      rating: 4.5,
      tastedAt: '2026-08-22',
    })

    expect(
      await t.withIdentity(carol).query(api.tastings.listByKind, {
        groupSlug: 'other-house',
        kind: 'wine',
      }),
    ).toEqual([])
  })

  test('a Tasting logged against another Group’s subject is refused', async () => {
    const t = await seed()
    const { subjectId } = await t
      .withIdentity(alice)
      .mutation(api.tastings.logTasting, {
        ...CLUB,
        kind: 'wine',
        subject: { name: 'Vajra Barolo 2019' },
        rating: 4.5,
        tastedAt: '2026-08-22',
      })

    await expect(
      t.withIdentity(carol).mutation(api.tastings.logTasting, {
        groupSlug: 'other-house',
        kind: 'wine',
        subject: { subjectId },
        rating: 2,
        tastedAt: '2026-08-22',
      }),
    ).rejects.toThrow('Subject not found')
  })
})

describe('the catalog', () => {
  test('offers cheeses to anyone signed in, and nothing to nobody', async () => {
    const t = await seed()

    const cheeses = await t
      .withIdentity(carol)
      .query(api.tastings.catalogByKind, { kind: 'cheese' })
    expect(cheeses.length).toBeGreaterThan(20)
    expect(cheeses.map((entry) => entry.seedKey)).toContain('cheese-comte')

    expect(
      await t.query(api.tastings.catalogByKind, { kind: 'cheese' }),
    ).toEqual([])
  })

  test('ships nothing for wine or beer, deliberately', async () => {
    const t = await seed()
    expect(
      await t
        .withIdentity(alice)
        .query(api.tastings.catalogByKind, { kind: 'wine' }),
    ).toEqual([])
    expect(
      await t
        .withIdentity(alice)
        .query(api.tastings.catalogByKind, { kind: 'beer' }),
    ).toEqual([])
  })

  test('is copied and never pointed at, so editing a subject leaves it alone', async () => {
    const t = await seed()
    const { subjectId } = await t
      .withIdentity(alice)
      .mutation(api.tastings.logTasting, {
        ...CLUB,
        kind: 'cheese',
        subject: { name: 'Comté', catalogKey: 'cheese-comte' },
        rating: 4,
        tastedAt: '2026-08-22',
      })
    await t.withIdentity(alice).mutation(api.tastings.updateSubject, {
      ...CLUB,
      id: subjectId,
      name: 'Our Comté',
      attributes: { milk: 'goat' },
    })

    // The only functions that write a subject take a `tastingSubjects` id, and
    // the household's row is not the catalog's — so the strongest thing this
    // can assert is that the shipped entry reads exactly as shipped after
    // somebody has edited "their" copy of it (ADR-0024).
    const catalog = await t
      .withIdentity(bob)
      .query(api.tastings.catalogByKind, { kind: 'cheese' })
    const comte = catalog.find((entry) => entry.seedKey === 'cheese-comte')
    expect(comte?.name).toBe('Comté')
    expect(comte?.attributes).toEqual({
      milk: 'cow',
      country: 'france',
      style: 'hard',
    })
  })

  test('re-seeding is idempotent and puts an edited row back', async () => {
    const t = await seed()
    const before = await t
      .withIdentity(alice)
      .query(api.tastings.catalogByKind, { kind: 'cheese' })

    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('tastingCatalog')
        .withIndex('by_seedKey', (q) => q.eq('seedKey', 'cheese-comte'))
        .unique()
      if (row) await ctx.db.patch(row._id, { name: 'Vandalised' })
    })
    await t.mutation(internal.seed.seedTastingCatalog, {})

    const after = await t
      .withIdentity(alice)
      .query(api.tastings.catalogByKind, { kind: 'cheese' })
    expect(after).toEqual(before)
  })
})

describe('the Group’s activity', () => {
  test('a Tasting appears, and creating its subject does not', async () => {
    const t = await seed()
    await t.withIdentity(bob).mutation(api.tastings.logTasting, {
      ...CLUB,
      kind: 'wine',
      subject: { name: 'Vajra Barolo 2019' },
      rating: 4.5,
      tastedAt: '2026-08-22',
    })

    const stream = await t
      .withIdentity(alice)
      .query(api.activity.forGroup, CLUB)
    const entries = stream.filter((entry) => entry.kind === 'tasting')

    // One act of logging, one line (story 28).
    expect(entries).toHaveLength(1)
    expect(entries[0].byName).toBe('Bob')
    expect(entries[0].title).toBe('Vajra Barolo 2019')
    // Which of the three tasting Modules it was — `kind` alone cannot say.
    expect(entries[0].moduleId).toBe('wines')
  })

  test('a deleted subject takes its lines out of the stream with it', async () => {
    const t = await seed()
    const { subjectId } = await t
      .withIdentity(alice)
      .mutation(api.tastings.logTasting, {
        ...CLUB,
        kind: 'beer',
        subject: { name: 'Westmalle Tripel' },
        rating: 4.5,
        tastedAt: '2026-08-22',
      })
    await t
      .withIdentity(alice)
      .mutation(api.tastings.removeSubject, { ...CLUB, id: subjectId })

    const stream = await t
      .withIdentity(alice)
      .query(api.activity.forGroup, CLUB)
    expect(stream.filter((entry) => entry.kind === 'tasting')).toEqual([])
  })
})
