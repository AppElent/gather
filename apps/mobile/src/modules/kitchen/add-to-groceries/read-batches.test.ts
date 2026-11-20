import { describe, expect, it, vi } from 'vitest'

import {
  AI_LINES_MAX,
  type ReadAnswer,
  type ReadBatch,
  readInBatches,
} from './read-batches'

const texts = (count: number) =>
  Array.from({ length: count }, (_, index) => `regel ${index + 1}`)

/** An AI that reads every line it is given, counting its calls. */
function reader(answers?: (call: number) => ReadAnswer | Error | undefined) {
  let calls = 0
  return vi.fn(async (lines: string[]): Promise<ReadAnswer> => {
    calls++
    const given = answers?.(calls)
    if (given instanceof Error) throw given
    return (
      given ?? {
        status: 'read',
        used: calls,
        limit: 30,
        lines: lines.map((line) => ({ name: line })),
      }
    )
  })
}

describe('readInBatches', () => {
  it('reads 41 lines in two calls: 40, then 1', async () => {
    const read = reader()
    const batches: ReadBatch[] = []
    await readInBatches(texts(41), read, (batch) => batches.push(batch))
    expect(read.mock.calls.map(([lines]) => lines.length)).toEqual([AI_LINES_MAX, 1])
    expect(batches.map((batch) => batch.texts.length)).toEqual([40, 1])
    expect(batches.flatMap((batch) => batch.texts)).toEqual(texts(41))
    // Every line comes back read, and the count is the last call's.
    expect(batches.flatMap((batch) => batch.lines).every(Boolean)).toBe(true)
    expect(batches[1].count).toEqual({ used: 2, limit: 30 })
  })

  it('reads 100 lines in three calls, each batch in order', async () => {
    const read = reader()
    await readInBatches(texts(100), read, () => undefined)
    expect(read.mock.calls.map(([lines]) => lines.length)).toEqual([40, 40, 20])
    expect(read.mock.calls[1][0][0]).toBe('regel 41')
  })

  it('a line the AI read as plain text comes back null', async () => {
    const read = reader(() => ({ status: 'read', used: 1, limit: 30, lines: [{ name: 'Uien' }, null] }))
    const batches: ReadBatch[] = []
    await readInBatches(['2 uien', 'iets'], read, (batch) => batches.push(batch))
    expect(batches[0].lines).toEqual([{ name: 'Uien' }, null])
  })

  it('stops when the cap runs out mid-week: the lines after it are not asked', async () => {
    const read = reader((call) => (call === 2 ? { status: 'limit', limit: 30 } : undefined))
    const batches: ReadBatch[] = []
    await readInBatches(texts(100), read, (batch) => batches.push(batch))
    // The first batch was read; the second hit the cap; the third is never sent.
    expect(read).toHaveBeenCalledTimes(2)
    expect(batches.map((batch) => batch.texts.length)).toEqual([40])
    expect(batches[0].count).toEqual({ used: 1, limit: 30 })
  })

  it('stops when the AI is unavailable or the call fails', async () => {
    const unavailable = reader((call) => (call === 1 ? { status: 'unavailable' } : undefined))
    const onBatch = vi.fn()
    await readInBatches(texts(50), unavailable, onBatch)
    expect(unavailable).toHaveBeenCalledTimes(1)
    expect(onBatch).not.toHaveBeenCalled()

    const offline = reader((call) => (call === 2 ? new Error('offline') : undefined))
    const heard: ReadBatch[] = []
    await readInBatches(texts(90), offline, (batch) => heard.push(batch))
    expect(offline).toHaveBeenCalledTimes(2)
    expect(heard).toHaveLength(1)
  })

  it('stops when the sheet is gone', async () => {
    let live = true
    const read = reader()
    await readInBatches(texts(100), read, () => {
      live = false
    }, () => live)
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('asks nothing when there is nothing to read', async () => {
    const read = reader()
    await readInBatches([], read, () => undefined)
    expect(read).not.toHaveBeenCalled()
  })
})
