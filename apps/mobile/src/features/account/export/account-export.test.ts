import { beforeEach, describe, expect, test, vi } from 'vitest'

/** An in-memory cache directory standing in for `expo-file-system`. */
const cache = vi.hoisted(() => new Map<string, string>())
const sharing = vi.hoisted(() => ({
  isAvailableAsync: vi.fn(),
  shareAsync: vi.fn(),
}))

vi.mock('expo-sharing', () => sharing)
vi.mock('expo-file-system', () => {
  class File {
    constructor(
      _dir: unknown,
      readonly name: string,
    ) {}
    get uri() {
      return `file:///cache/${this.name}`
    }
    get exists() {
      return cache.has(this.name)
    }
    create() {
      cache.set(this.name, '')
    }
    write(text: string) {
      cache.set(this.name, text)
    }
    delete() {
      cache.delete(this.name)
    }
  }
  return {
    File,
    Paths: {
      cache: { list: () => [...cache.keys()].map((n) => new File(null, n)) },
    },
  }
})
vi.mock('../../../../../../convex/_generated/api', () => ({
  api: { dataExport: { manifest: 'manifest', page: 'page' } },
}))

import type { ConvexReactClient } from 'convex/react'
import { DataExportError, exportMyData } from './account-export'

function convexServing() {
  const query = vi.fn(async (fn: string) =>
    fn === 'manifest'
      ? {
          version: 1,
          account: ['users'],
          group: [],
          excluded: [],
          omittedFields: {},
          groups: [],
        }
      : { rows: [{ id: 'u1' }], cursor: null, isDone: true },
  )
  return { query, client: { query } as unknown as ConvexReactClient }
}

beforeEach(() => {
  cache.clear()
  sharing.isAvailableAsync.mockReset()
  sharing.shareAsync.mockReset()
})

describe('exportMyData', () => {
  test('hands one JSON file to the system share sheet', async () => {
    sharing.isAvailableAsync.mockResolvedValue(true)
    sharing.shareAsync.mockResolvedValue(undefined)
    cache.set('gather-export-2026-01-01.json', 'stale')
    const { client } = convexServing()

    await exportMyData(client, () => {})

    expect(sharing.shareAsync).toHaveBeenCalledTimes(1)
    const [uri, options] = sharing.shareAsync.mock.calls[0]
    expect(uri).toMatch(
      /^file:\/\/\/cache\/gather-export-\d{4}-\d{2}-\d{2}\.json$/,
    )
    expect(options).toEqual({
      mimeType: 'application/json',
      UTI: 'public.json',
    })
    // The earlier export is gone; this one stays for the receiving app to read.
    expect([...cache.keys()]).toHaveLength(1)
    const file = JSON.parse([...cache.values()][0])
    expect(file.format).toBe('gather.data-export')
    expect(file.account.users).toEqual([{ id: 'u1' }])
  })

  test('fails when the sheet cannot open', async () => {
    sharing.isAvailableAsync.mockResolvedValue(true)
    sharing.shareAsync.mockRejectedValue(new Error('ERR_SHARING_MEM'))
    const { client } = convexServing()

    await expect(exportMyData(client, () => {})).rejects.toThrow(
      'ERR_SHARING_MEM',
    )
  })

  test('says sharing is unavailable before reading anything', async () => {
    sharing.isAvailableAsync.mockResolvedValue(false)
    const { client, query } = convexServing()

    const error = await exportMyData(client, () => {}).catch((e) => e)

    expect(error).toBeInstanceOf(DataExportError)
    expect(error.reason).toBe('unavailable')
    expect(query).not.toHaveBeenCalled()
    expect(sharing.shareAsync).not.toHaveBeenCalled()
  })
})
