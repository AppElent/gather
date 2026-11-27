import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  changeDraft,
  deleteWithDraft,
  discardDraft,
  flushDraft,
  IDLE,
  retryDraft,
  useNoteDraft,
} from './noteDrafts'

const KEY = 'u1:g1:n1'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  discardDraft(KEY)
  vi.useRealTimers()
})

/** A send whose answers the test gives. */
function controlled() {
  const answers: { ok: () => void; no: (error: unknown) => void }[] = []
  const send = vi.fn(
    () =>
      new Promise<void>((resolve, reject) => {
        answers.push({ ok: resolve, no: reject })
      }),
  )
  return { send, answers }
}

const settle = () => act(async () => void (await vi.advanceTimersByTimeAsync(0)))

describe('saving', () => {
  test('waits for a pause, then sends only the changed fields once', async () => {
    const send = vi.fn(async () => {})
    changeDraft(KEY, { title: 'W' }, send)
    vi.advanceTimersByTime(IDLE - 1)
    changeDraft(KEY, { title: 'Wifi' }, send)
    vi.advanceTimersByTime(IDLE - 1)
    expect(send).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(send).toHaveBeenCalledExactlyOnceWith({ title: 'Wifi' })
    const { result } = renderHook(() => useNoteDraft(KEY))
    await settle()
    expect(result.current).toBeUndefined()
  })

  test('a flush sends now, and the timer sends nothing after it', async () => {
    const send = vi.fn(async () => {})
    changeDraft(KEY, { body: 'a' }, send)
    flushDraft(KEY)
    await vi.advanceTimersByTimeAsync(IDLE * 2)
    expect(send).toHaveBeenCalledTimes(1)
  })

  test('text typed during a save is kept and sent after it, never alongside', async () => {
    const { send, answers } = controlled()
    const { result } = renderHook(() => useNoteDraft(KEY))
    act(() => {
      changeDraft(KEY, { title: 'T', body: 'one' }, send)
      flushDraft(KEY)
    })
    act(() => {
      changeDraft(KEY, { body: 'one two' }, send)
      flushDraft(KEY)
      vi.advanceTimersByTime(IDLE * 2)
    })
    expect(send).toHaveBeenCalledTimes(1)
    answers[0]?.ok()
    await settle()
    expect(result.current?.fields).toEqual({ body: 'one two' })
    await act(async () => void (await vi.advanceTimersByTimeAsync(IDLE)))
    expect(send).toHaveBeenLastCalledWith({ body: 'one two' })
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
      changeDraft(KEY, { body: 'mine' }, send)
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
    changeDraft(KEY, { body: 'mine' }, send)
    flushDraft(KEY)
    answers[0]?.no(new Error('refused'))
    await settle()
    changeDraft(KEY, { title: 'T' }, send)
    await vi.advanceTimersByTimeAsync(IDLE)
    expect(send).toHaveBeenLastCalledWith({ title: 'T', body: 'mine' })
  })

  test('the page asks before it is closed, until the text is saved', () => {
    const leave = () => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }
    expect(leave()).toBe(false)
    changeDraft(KEY, { body: 'mine' }, () => new Promise(() => {}))
    expect(leave()).toBe(true)
    discardDraft(KEY)
    expect(leave()).toBe(false)
  })
})

describe('deleting', () => {
  test('sends nothing more, and drops the draft', async () => {
    const send = vi.fn(async () => {})
    changeDraft(KEY, { body: 'mine' }, send)
    await deleteWithDraft(KEY, async () => {
      // The editor closes before the delete answers.
      flushDraft(KEY)
    })
    await vi.advanceTimersByTimeAsync(IDLE * 2)
    expect(send).not.toHaveBeenCalled()
  })

  test('a refused delete still saves the text', async () => {
    const send = vi.fn(async () => {})
    changeDraft(KEY, { body: 'mine' }, send)
    await expect(
      deleteWithDraft(KEY, () => Promise.reject(new Error('no'))),
    ).rejects.toThrow('no')
    await vi.advanceTimersByTimeAsync(IDLE)
    expect(send).toHaveBeenCalledExactlyOnceWith({ body: 'mine' })
  })
})
