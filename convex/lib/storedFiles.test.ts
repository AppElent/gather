import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  alice,
  seedGroup,
  seedMember,
  testConvex,
  testConvexWithLimits,
} from '../../test/convexHarness'
import { api, internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { deleteStoredFile, replaceStoredFile } from './storedFiles'

/**
 * The compare-and-delete rule on its own, away from any Module.
 *
 * Every table holding a photo calls this; the four transitions below are the
 * whole of what they get, so they are asserted once here rather than once per
 * Module through its mutations.
 */

const t = () => testConvex()

/** A blob in storage, plus the answer to "is it still there?". */
async function storedBlob() {
  const harness = t()
  const id = await harness.run(async (ctx) =>
    ctx.storage.store(new Blob(['x'])),
  )
  const exists = async (fileId: Id<'_storage'>) =>
    await harness.run(
      async (ctx) => (await ctx.storage.getUrl(fileId)) !== null,
    )
  return { harness, id, exists }
}

/**
 * A ctx that only remembers being asked. Storage is the one thing here with a
 * cost per call, and "leaves the file alone" and "never asks storage anything"
 * are different claims — the tests that use this assert the second, which a
 * state assertion cannot see.
 */
function recordingCtx() {
  const calls: string[] = []
  const ctx = {
    db: {
      system: {
        get: async () => {
          calls.push('metadata')
          return null
        },
      },
    },
    storage: {
      delete: async () => {
        calls.push('delete')
      },
    },
  } as unknown as MutationCtx
  return { ctx, calls }
}

describe('the transitions that orphan nothing touch storage not at all', () => {
  const someFile = 'file' as Id<'_storage'>

  test('a row that held no file', async () => {
    const { ctx, calls } = recordingCtx()

    await deleteStoredFile(ctx, undefined)
    await replaceStoredFile(ctx, undefined, someFile)

    expect(calls).toEqual([])
  })

  test('an edit that leaves the field alone, or repeats the same id', async () => {
    const { ctx, calls } = recordingCtx()

    await replaceStoredFile(ctx, someFile, undefined)
    await replaceStoredFile(ctx, someFile, someFile)

    expect(calls).toEqual([])
  })
})

describe('replacing the file a row points at', () => {
  test('a different id deletes the one that was stored', async () => {
    const { harness, id, exists } = await storedBlob()
    const next = await harness.run(async (ctx) =>
      ctx.storage.store(new Blob(['y'])),
    )

    await harness.run(async (ctx) => {
      await replaceStoredFile(ctx as MutationCtx, id, next)
    })

    expect(await exists(id)).toBe(false)
    expect(await exists(next)).toBe(true)
  })

  test('null clears the row, so the stored file goes', async () => {
    const { harness, id, exists } = await storedBlob()

    await harness.run(async (ctx) => {
      await replaceStoredFile(ctx as MutationCtx, id, null)
    })

    expect(await exists(id)).toBe(false)
  })

  test('the same id is not a replacement and deletes nothing', async () => {
    const { harness, id, exists } = await storedBlob()

    await harness.run(async (ctx) => {
      await replaceStoredFile(ctx as MutationCtx, id, id)
    })

    expect(await exists(id)).toBe(true)
  })

  test('an absent field means "leave it alone", not "clear it"', async () => {
    const { harness, id, exists } = await storedBlob()

    await harness.run(async (ctx) => {
      await replaceStoredFile(ctx as MutationCtx, id, undefined)
    })

    expect(await exists(id)).toBe(true)
  })

  test('a row that held no file has nothing to delete', async () => {
    const { harness, id, exists } = await storedBlob()

    await harness.run(async (ctx) => {
      await replaceStoredFile(ctx as MutationCtx, undefined, id)
    })

    expect(await exists(id)).toBe(true)
  })
})

/**
 * Nothing stops two rows holding one `_storage` id — the ids are supplied by
 * the client and handed back on every read — so the last row to let go of a
 * blob is the one that deletes it, not the first (PR #58 review).
 */
describe('a file another row still points at', () => {
  /** A recipe row holding `imageId`, with the Group and person it needs. */
  async function recipeHolding(
    harness: ReturnType<typeof t>,
    imageId: Id<'_storage'>,
  ) {
    return await harness.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        clerkId: 'clerk_someone',
        name: 'Someone',
        email: 'someone@example.com',
      })
      const groupId = await ctx.db.insert('groups', {
        name: 'Household',
        slug: 'household',
        inviteCode: 'code',
      })
      return await ctx.db.insert('recipes', {
        groupId,
        sharedGroupIds: [],
        createdByUserId: userId,
        title: 'Holds the picture',
        ingredients: [],
        steps: [],
        tags: [],
        imageId,
      })
    })
  }

  test('is kept', async () => {
    const { harness, id, exists } = await storedBlob()
    await recipeHolding(harness, id)

    await harness.run(async (ctx) => {
      await deleteStoredFile(ctx as MutationCtx, id)
    })

    expect(await exists(id)).toBe(true)
  })

  test('goes once that row lets go of it too', async () => {
    const { harness, id, exists } = await storedBlob()
    const holder = await recipeHolding(harness, id)

    await harness.run(async (ctx) => {
      await ctx.db.delete(holder)
      await deleteStoredFile(ctx as MutationCtx, id)
    })

    expect(await exists(id)).toBe(false)
  })

  test('is kept when a replacement leaves the other row holding it', async () => {
    const { harness, id, exists } = await storedBlob()
    await recipeHolding(harness, id)
    const next = await harness.run(async (ctx) =>
      ctx.storage.store(new Blob(['y'])),
    )

    await harness.run(async (ctx) => {
      await replaceStoredFile(ctx as MutationCtx, id, next)
    })

    expect(await exists(id)).toBe(true)
  })
})

describe('deleting the file a row held', () => {
  test('removes it from storage', async () => {
    const { harness, id, exists } = await storedBlob()

    await harness.run(async (ctx) => {
      await deleteStoredFile(ctx as MutationCtx, id)
    })

    expect(await exists(id)).toBe(false)
  })

  test('a row with no file is not a call to storage', async () => {
    const { harness, id, exists } = await storedBlob()

    await harness.run(async (ctx) => {
      await deleteStoredFile(ctx as MutationCtx, undefined)
    })

    expect(await exists(id)).toBe(true)
  })

  // A blob deleted out of band leaves a row still pointing at it. Throwing
  // there would make the record undeletable, which is a worse state than the
  // stale pointer it is trying to clean up.
  test('a file that is already gone is not an error', async () => {
    const { harness, id, exists } = await storedBlob()
    await harness.run(async (ctx) => {
      await ctx.storage.delete(id)
    })

    await harness.run(async (ctx) => {
      await deleteStoredFile(ctx as MutationCtx, id)
    })

    expect(await exists(id)).toBe(false)
  })

  test('replacing a file that is already gone is not an error either', async () => {
    const { harness, id, exists } = await storedBlob()
    const next = await harness.run(async (ctx) =>
      ctx.storage.store(new Blob(['y'])),
    )
    await harness.run(async (ctx) => {
      await ctx.storage.delete(id)
    })

    await harness.run(async (ctx) => {
      await replaceStoredFile(ctx as MutationCtx, id, next)
    })

    expect(await exists(next)).toBe(true)
  })
})

/** The backend here refuses what Convex would (APP-876). */
describe('releasing a file beside more rows than one transaction may read', () => {
  type Storage = Id<'_storage'>

  /** A Group with 20 recipes of 900 kB each, over the 16 MiB one step reads. */
  async function manyLargeRecipes() {
    const harness = testConvexWithLimits()
    const ids = await harness.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        clerkId: alice.subject,
        name: alice.name,
        email: alice.email,
      })
      const groupId = await seedGroup(ctx, { name: 'Home', slug: 'home' })
      await seedMember(ctx, groupId, userId, 'admin')
      return { userId, groupId }
    })
    const recipe = (imageId?: Storage) => ({
      groupId: ids.groupId,
      sharedGroupIds: [],
      createdByUserId: ids.userId,
      title: 'Large',
      ingredients: [],
      steps: ['x'.repeat(900_000)],
      tags: [],
      imageId,
    })
    for (let page = 0; page < 4; page += 1) {
      await harness.run(async (ctx) => {
        for (let row = 0; row < 5; row += 1) {
          await ctx.db.insert('recipes', recipe())
        }
      })
    }
    return { harness, ...ids, recipe }
  }

  const store = (harness: ReturnType<typeof testConvexWithLimits>) =>
    harness.run(async (ctx) => ctx.storage.store(new Blob(['x'])))
  const exists = (
    harness: ReturnType<typeof testConvexWithLimits>,
    id: Storage,
  ) => harness.run(async (ctx) => (await ctx.storage.getUrl(id)) !== null)

  test('reading those rows whole is refused', async () => {
    const { harness } = await manyLargeRecipes()
    await expect(
      harness.run(async (ctx) => {
        await ctx.db.query('recipes').collect()
      }),
    ).rejects.toThrow(/bytes/i)
  })

  describe('by the scheduled release', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    async function release(
      harness: ReturnType<typeof testConvexWithLimits>,
      storageIds: Storage[],
    ) {
      await harness.mutation(internal.cascade.releaseFiles, { storageIds })
      await harness.finishAllScheduledFunctions(vi.runAllTimers)
      const steps = await harness.run((ctx) =>
        ctx.db.system.query('_scheduled_functions').collect(),
      )
      expect(steps.map(({ state }) => state.kind)).toEqual(
        steps.map(() => 'success'),
      )
    }

    test('every file goes, over several steps', async () => {
      const { harness } = await manyLargeRecipes()
      const files: Storage[] = []
      for (let i = 0; i < 25; i += 1) files.push(await store(harness))

      await release(harness, files)

      for (const id of files) expect(await exists(harness, id)).toBe(false)
    })

    test('files still held by rows of the largest size are kept', async () => {
      const { harness, recipe } = await manyLargeRecipes()
      const files: Storage[] = []
      for (let i = 0; i < 20; i += 1) {
        const id = await store(harness)
        files.push(id)
        await harness.run(async (ctx) => {
          await ctx.db.insert('recipes', {
            ...recipe(id),
            steps: ['x'.repeat(1_040_000)],
          })
        })
      }

      await release(harness, files)

      for (const id of files) expect(await exists(harness, id)).toBe(true)
    })
  })

  test('replacing and deleting a photo through its Module', async () => {
    const { harness } = await manyLargeRecipes()
    const me = harness.withIdentity(alice)
    const [front, back, next] = [
      await store(harness),
      await store(harness),
      await store(harness),
    ]
    const card = {
      groupSlug: 'home',
      storeName: 'Corner shop',
      cardNumber: '2620187342052',
      barcodeFormat: 'EAN_13' as const,
    }
    const id = await me.mutation(api.loyaltyCards.create, {
      ...card,
      frontPhotoId: front,
      backPhotoId: back,
    })

    await me.mutation(api.loyaltyCards.update, {
      ...card,
      id,
      frontPhotoId: next,
    })
    expect(await exists(harness, front)).toBe(false)
    expect(await exists(harness, back)).toBe(true)

    await me.mutation(api.loyaltyCards.remove, { groupSlug: 'home', id })
    expect(await exists(harness, back)).toBe(false)
    expect(await exists(harness, next)).toBe(false)
  })
})

describe('a file held by any photo column is kept', () => {
  test.each([
    'babies.photoId',
    'babyEvents.photoId',
    'recipes.imageId',
    'groups.imageId',
    'tastingSubjects.photoId',
    'loyaltyCards.frontPhotoId',
    'loyaltyCards.backPhotoId',
  ])('%s', async (column) => {
    const { harness, id, exists } = await storedBlob()
    const holder = await harness.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        clerkId: 'clerk_someone',
        name: 'Someone',
        email: 'someone@example.com',
      })
      const groupId = await seedGroup(ctx, { name: 'Home', slug: 'home' })
      const baby = { groupId, name: 'Mila', birthDate: '2026-01-01', order: 0 }
      switch (column) {
        case 'babies.photoId':
          return await ctx.db.insert('babies', { ...baby, photoId: id })
        case 'babyEvents.photoId':
          return await ctx.db.insert('babyEvents', {
            babyId: await ctx.db.insert('babies', baby),
            type: 'note',
            timestamp: 0,
            loggedBy: userId,
            data: {},
            photoId: id,
          })
        case 'recipes.imageId':
          return await ctx.db.insert('recipes', {
            groupId,
            sharedGroupIds: [],
            createdByUserId: userId,
            title: 'Soup',
            ingredients: [],
            steps: [],
            tags: [],
            imageId: id,
          })
        case 'groups.imageId':
          await ctx.db.patch(groupId, { imageId: id })
          return groupId
        case 'tastingSubjects.photoId':
          return await ctx.db.insert('tastingSubjects', {
            groupId,
            kind: 'cheese',
            name: 'Gouda',
            attributes: {},
            createdByUserId: userId,
            photoId: id,
          })
        default:
          return await ctx.db.insert('loyaltyCards', {
            groupId,
            storeName: 'Corner shop',
            cardNumber: '2620187342052',
            barcodeFormat: 'EAN_13',
            createdByUserId: userId,
            [column.split('.')[1]]: id,
          })
      }
    })

    await harness.run(async (ctx) => {
      await deleteStoredFile(ctx as MutationCtx, id)
    })
    expect(await exists(id)).toBe(true)

    await harness.run(async (ctx) => {
      await ctx.db.delete(holder)
      await deleteStoredFile(ctx as MutationCtx, id)
    })
    expect(await exists(id)).toBe(false)
  })
})
