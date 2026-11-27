/**
 * A Drop appended to a note that a housemate saved in the meantime (APP-999).
 */
import { describe, expect, test, vi } from 'vitest'

import {
  appendToNote,
  NoteAppendConflict,
  type NoteUpdateResult,
} from './appendToNote'

describe('appending a Drop to a note', () => {
  test('sends the version it read as the base', async () => {
    const write = vi.fn(
      async (): Promise<NoteUpdateResult> => ({
        status: 'saved',
        updatedAt: 2,
      }),
    )
    await appendToNote(write, { body: 'Ours', updatedAt: 1 }, 'Shared')
    expect(write).toHaveBeenCalledExactlyOnceWith({
      body: 'Ours\n\nShared',
      baseUpdatedAt: 1,
    })
  })

  test('a housemate’s newer save is kept, and the Drop goes after it', async () => {
    const write = vi
      .fn<(args: { body: string; baseUpdatedAt?: number }) => Promise<NoteUpdateResult>>()
      .mockResolvedValueOnce({
        status: 'conflict',
        note: { body: 'Ours plus theirs', updatedAt: 5 },
      })
      .mockResolvedValueOnce({ status: 'saved', updatedAt: 6 })

    await appendToNote(write, { body: 'Ours', updatedAt: 1 }, 'Shared')

    expect(write).toHaveBeenCalledTimes(2)
    expect(write).toHaveBeenLastCalledWith({
      body: 'Ours plus theirs\n\nShared',
      baseUpdatedAt: 5,
    })
  })

  test('a note that keeps changing is reported, not overwritten', async () => {
    let version = 1
    const write = vi.fn(
      async (): Promise<NoteUpdateResult> => ({
        status: 'conflict',
        note: { body: `v${++version}`, updatedAt: version },
      }),
    )
    await expect(
      appendToNote(write, { body: 'v1', updatedAt: 1 }, 'Shared'),
    ).rejects.toBeInstanceOf(NoteAppendConflict)
    expect(write).toHaveBeenCalledTimes(3)
  })
})
