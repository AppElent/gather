/** An upload is reused only within the draft that started it (APP-734). */
import { beforeEach, expect, test, vi } from 'vitest'

import { forgetDrafts, keepDraft } from '../ui/composer-drafts'
import { forgetUploads, uploadOnce } from './uploads'

const start = vi.fn()

beforeEach(() => {
  forgetDrafts()
  start.mockReset()
  start.mockImplementation(() => Promise.resolve(`stored_${start.mock.calls.length}`))
})

test('the same file within a draft is uploaded once', async () => {
  expect(await uploadOnce('draft-1', 'file:///a.jpg', start)).toBe('stored_1')
  expect(await uploadOnce('draft-1', 'file:///a.jpg', start)).toBe('stored_1')
  expect(start).toHaveBeenCalledOnce()
})

test('another draft does not take up the upload, even for the same file', async () => {
  await uploadOnce('draft-1', 'file:///a.jpg', start)
  expect(await uploadOnce('draft-2', 'file:///a.jpg', start)).toBe('stored_2')
  expect(start).toHaveBeenCalledTimes(2)
})

test('a discarded draft forgets its uploads, and a new draft on that place starts fresh', async () => {
  keepDraft('place', { text: 'typed' })
  await uploadOnce('place', 'file:///a.jpg', start)
  // A share keeps the draft: the reopened form still takes up the upload.
  expect(await uploadOnce('place', 'file:///a.jpg', start)).toBe('stored_1')
  // Cancelled, saved or swiped away: the draft is gone, and so is the upload.
  keepDraft('place', undefined)
  expect(await uploadOnce('place', 'file:///a.jpg', start)).toBe('stored_2')
})

test('a failed upload is sent again', async () => {
  start.mockReset()
  start.mockRejectedValueOnce(new Error('offline'))
  await expect(uploadOnce('d', 'file:///a.jpg', start)).rejects.toThrow()
  start.mockResolvedValueOnce('stored_ok')
  expect(await uploadOnce('d', 'file:///a.jpg', start)).toBe('stored_ok')
  forgetUploads('d')
})
