/** One prepared file is stored once, however often it is asked for. */
import { beforeEach, expect, test, vi } from 'vitest'

import { uploadPhotoOnce } from './pickPhoto'

const send = vi.hoisted(() => vi.fn())

vi.mock('expo-file-system', () => ({
  File: class {
    upload = send
  },
  UploadType: { BINARY_CONTENT: 0 },
}))
vi.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: {} }))
vi.mock('../observability/native-presentation', () => ({}))

const url = vi.fn(() => Promise.resolve('https://upload'))
const landed = (storageId: string) => ({
  status: 200,
  body: JSON.stringify({ storageId }),
})

beforeEach(() => {
  send.mockReset()
  url.mockClear()
})

test('a second ask takes up the upload on its way, and the one that landed', async () => {
  let land = (_: unknown) => {}
  send.mockReturnValueOnce(
    new Promise((done) => {
      land = done
    }),
  )
  const first = uploadPhotoOnce('file:///a.jpg', url)
  const second = uploadPhotoOnce('file:///a.jpg', url)
  await Promise.resolve()
  land(landed('stored_1'))
  expect(await first).toBe('stored_1')
  expect(await second).toBe('stored_1')
  expect(await uploadPhotoOnce('file:///a.jpg', url)).toBe('stored_1')
  expect(send).toHaveBeenCalledOnce()
  expect(url).toHaveBeenCalledOnce()
})

test('a failed upload is sent again, and another file is its own upload', async () => {
  send.mockResolvedValueOnce({ status: 500, body: '' })
  await expect(uploadPhotoOnce('file:///b.jpg', url)).rejects.toThrow()
  send.mockResolvedValueOnce(landed('stored_2'))
  expect(await uploadPhotoOnce('file:///b.jpg', url)).toBe('stored_2')
  send.mockResolvedValueOnce(landed('stored_3'))
  expect(await uploadPhotoOnce('file:///c.jpg', url)).toBe('stored_3')
})
