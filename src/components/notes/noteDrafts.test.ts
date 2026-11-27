import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  changeDraft,
  deleteWithDraft,
  discardDraft,
  flushDraft,
  IDLE,
  keepMineDraft,
  type NoteFields,
  retryDraft,
  type SaveResult,
  useNoteDraft,
} from './noteDrafts'

const KEY = 'u1:g1:n1'
/** The note as the editor showed it when typing began. */
const BASE = { title: 'Wifi', body: 'code', updatedAt: 1 }

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  discardDraft(KEY)
  vi.useRealTimers()
})

/** A send whose answers the test gives. */
function controlled() {
  const answers: {
    ok: (result?: SaveResult) => void
    no: (error: unknown) => void
  }[] = []
  const send = vi.fn(
    (_fields: NoteFields, _base: number) =>
      new Promise<SaveResult>((resolve, reject) => {
        answers.push({ ok: resolve, no: reject })
      }),
  )
  return { send, answers }
}

const settle = () => act(async () => void (await vi.advanceTimersByTimeAsync(0)))

describe('saving', () => {
  test('waits for a pause, then sends only the changed fields once', async () => {
    const send = vi.fn(async () => {})
    changeDraft(KEY, { title: 'W' }, send, BASE)
    vi.advanceTimersByTime(IDLE - 1)
    changeDraft(KEY, { title: 'Wifi' }, send, BASE)
    vi.advanceTimersByTime(IDLE - 1)
    expect(send).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(send).toHaveBeenCalledExactlyOnceWith({ title: 'Wifi' }, 1)
    const { result } = renderHook(() => useNoteDraft(KEY))
    await settle()
    expect(result.current).toBeUndefined()
  })

  test('a flush sends now, and the timer sends nothing after it', async () => {
    const send = vi.fn(async () => {})
    changeDraft(KEY, { body: 'a' }, send, BASE)
    flushDraft(KEY)
    await vi.advanceTimersByTimeAsync(IDLE * 2)
    expect(send).toHaveBeenCalledTimes(1)
  })

  test('text typed during a save is kept and sent after it, never alongside', async () => {
    const { send, answers } = controlled()
    const { result } = renderHook(() => useNoteDraft(KEY))
    act(() => {
      changeDraft(KEY, { title: 'T', body: 'one' }, send, BASE)
      flushDraft(KEY)
    })
    act(() => {
      changeDraft(KEY, { body: 'one two' }, send, BASE)
      flushDraft(KEY)
      vi.advanceTimersByTime(IDLE * 2)
    })
    expect(send).toHaveBeenCalledTimes(1)
    answers[0]?.ok()
    await settle()
    expect(result.current?.fields).toEqual({ body: 'one two' })
    await act(async () => void (await vi.advanceTimersByTimeAsync(IDLE)))
    expect(send).toHaveBeenLastCalledWith({ body: 'one two' }, 1)
    answers[1]?.ok()
    await settle()
    expect(result.current).toBeUndefined()
  })
})

describe('a failed save', () => {
  test('keeps the text, is not resent by a blur, and goes on retry', async () => {
    const { send, answers } = controlled()
    const { result } = renderHook(() => useNoteDraft(KEY))
    act(() => {
      changeDraft(KEY, { body: 'mine' }, send, BASE)
      flushDraft(KEY)
    })
    const error = new Error('refused')
    answers[0]?.no(error)
    await settle()
    expect(result.current).toEqual({
      fields: { body: 'mine' },
      state: 'failed',
      error,
    })
    flushDraft(KEY)
    await vi.advanceTimersByTimeAsync(IDLE * 2)
    expect(send).toHaveBeenCalledTimes(1)
    act(() => retryDraft(KEY))
    expect(send).toHaveBeenCalledTimes(2)
    answers[1]?.ok()
    await settle()
    expect(result.current).toBeUndefined()
  })

  test('typing on sends the unsaved fields with the new one', async () => {
    const { send, answers } = controlled()
    changeDraft(KEY, { body: 'mine' }, send, BASE)
    flushDraft(KEY)
    answers[0]?.no(new Error('refused'))
    await settle()
    changeDraft(KEY, { title: 'T' }, send, BASE)
    await vi.advanceTimersByTimeAsync(IDLE)
    expect(send).toHaveBeenLastCalledWith({ title: 'T', body: 'mine' }, 1)
  })

  test('the page asks before it is closed, until the text is saved', () => {
    const leave = () => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }
    expect(leave()).toBe(false)
    changeDraft(KEY, { body: 'mine' }, () => new Promise(() => {}), BASE)
    expect(leave()).toBe(true)
    discardDraft(KEY)
    expect(leave()).toBe(false)
  })
})

describe('deleting', () => {
  test('sends nothing more, and drops the draft', async () => {
    const send = vi.fn(async () => {})
    changeDraft(KEY, { body: 'mine' }, send, BASE)
    await deleteWithDraft(KEY, async () => {
      // The editor closes before the delete answers.
      flushDraft(KEY)
    })
    await vi.advanceTimersByTimeAsync(IDLE * 2)
    expect(send).not.toHaveBeenCalled()
  })

  test('a refused delete still saves the text', async () => {
    const send = vi.fn(async () => {})
    changeDraft(KEY, { body: 'mine' }, send, BASE)
    await expect(
      deleteWithDraft(KEY, () => Promise.reject(new Error('no'))),
    ).rejects.toThrow('no')
    await vi.advanceTimersByTimeAsync(IDLE)
    expect(send).toHaveBeenCalledExactlyOnceWith({ body: 'mine' }, 1)
  })
})

describe('a conflict (APP-994)', () => {
  const theirs = (fields: { title?: string; body?: string }, updatedAt = 5) => ({
    status: 'conflict' as const,
    note: { ...BASE, ...fields, updatedAt, updatedByName: 'Sam' },
  })

  test('each save names the version it was typed on, then the one it saved', async () => {
    const { send, answers } = controlled()
    changeDraft(KEY, { body: 'one' }, send, BASE)
    flushDraft(KEY)
    expect(send).toHaveBeenLastCalledWith({ body: 'one' }, 1)
    // Typed meanwhile on a newer note: the draft keeps the version it began on.
    changeDraft(KEY, { body: 'one two' }, send, { ...BASE, updatedAt: 9 })
    answers[0]?.ok({ status: 'saved', updatedAt: 3 })
    await settle()
    await vi.advanceTimersByTimeAsync(IDLE)
    expect(send).toHaveBeenLastCalledWith({ body: 'one two' }, 3)
  })

  test('another edit of the same field holds the text and sends nothing until a choice', async () => {
    const { send, answers } = controlled()
    const { result } = renderHook(() => useNoteDraft(KEY))
    act(() => {
      changeDraft(KEY, { body: 'mine' }, send, BASE)
      flushDraft(KEY)
    })
    answers[0]?.ok(theirs({ body: 'theirs' }))
    await settle()
    expect(result.current).toEqual({
      fields: { body: 'mine' },
      state: 'conflict',
      theirs: theirs({ body: 'theirs' }).note,
    })
    // Typing, a blur, a retry and time send nothing.
    act(() => changeDraft(KEY, { body: 'mine too' }, send, BASE))
    flushDraft(KEY)
    retryDraft(KEY)
    await vi.advanceTimersByTimeAsync(IDLE * 2)
    expect(send).toHaveBeenCalledTimes(1)
    expect(result.current?.state).toBe('conflict')
    expect(result.current?.fields).toEqual({ body: 'mine too' })
  })

  test('keep mine saves the text over their version', async () => {
    const { send, answers } = controlled()
    const { result } = renderHook(() => useNoteDraft(KEY))
    act(() => {
      changeDraft(KEY, { body: 'mine' }, send, BASE)
      flushDraft(KEY)
    })
    answers[0]?.ok(theirs({ body: 'theirs' }))
    await settle()
    act(() => keepMineDraft(KEY))
    expect(send).toHaveBeenLastCalledWith({ body: 'mine' }, 5)
    answers[1]?.ok({ status: 'saved', updatedAt: 6 })
    await settle()
    expect(result.current).toBeUndefined()
  })

  test('keep theirs drops the text', async () => {
    const { send, answers } = controlled()
    const { result } = renderHook(() => useNoteDraft(KEY))
    act(() => {
      changeDraft(KEY, { body: 'mine' }, send, BASE)
      flushDraft(KEY)
    })
    answers[0]?.ok(theirs({ body: 'theirs' }))
    await settle()
    act(() => discardDraft(KEY))
    await vi.advanceTimersByTimeAsync(IDLE * 2)
    expect(result.current).toBeUndefined()
    expect(send).toHaveBeenCalledTimes(1)
  })

  test('an edit of the other field only is sent again from their version, unasked', async () => {
    const { send, answers } = controlled()
    const { result } = renderHook(() => useNoteDraft(KEY))
    act(() => {
      changeDraft(KEY, { body: 'mine' }, send, BASE)
      flushDraft(KEY)
    })
    answers[0]?.ok(theirs({ title: 'Their title' }))
    await settle()
    expect(send).toHaveBeenLastCalledWith({ body: 'mine' }, 5)
    answers[1]?.ok({ status: 'saved', updatedAt: 6 })
    await settle()
    expect(result.current).toBeUndefined()
  })
})
