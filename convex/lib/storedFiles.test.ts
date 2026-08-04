import { describe, expect, test } from 'vitest'
import { testConvex } from '../../test/convexHarness'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { deleteStoredFile, replaceStoredFile } from './storedFiles'

/**
 * The compare-and-delete rule on its own, away from any Module.
 *
 * `babies` and `recipes` each hold one photo and each call this; the four
 * transitions below are the whole of what they get, so they are asserted once
 * here rather than twice through the mutations.
 */

const t = () => testConvex()

/** A blob in storage, plus the answer to "is it still there?". */
async function storedBlob() {
  const harness = t()
  const id = await harness.run(async (ctx) => ctx.storage.store(new Blob(['x'])))
  const exists = async (fileId: Id<'_storage'>) =>
    await harness.run(async (ctx) => (await ctx.storage.getUrl(fileId)) !== null)
  return { harness, id, exists }
}

/**
 * A ctx that only remembers being asked. Storage is the one thing here with a
 * cost per call, and "leaves the file alone" and "never asks storage anything"
 * are different claims — the tests below assert the second, which the state
 * assertions above cannot see.
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
