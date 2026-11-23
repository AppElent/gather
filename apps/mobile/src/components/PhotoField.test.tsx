// @vitest-environment jsdom
/** A kept draft's photo: shown again, and an unfinished upload finished. */
import { createElement, type ReactNode } from 'react'
import { expect, test, vi } from 'vitest'

import { mount, settle } from '../testing/dom'
import { PhotoField } from './PhotoField'

type Props = Record<string, unknown> & { children?: ReactNode }

const upload = vi.hoisted(() => vi.fn(() => Promise.resolve('stored_1')))

vi.mock('react-native', async () => {
  const h = (await import('react')).createElement
  const box = ({ children }: Props) => h('div', null, children)
  return {
    ActivityIndicator: () => null,
    View: box,
    Text: box,
    Pressable: box,
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  }
})
vi.mock('expo-image', async () => {
  const h = (await import('react')).createElement
  return {
    Image: ({ source }: { source: { uri: string } }) =>
      h('img', { src: source.uri, alt: '' }),
  }
})
vi.mock('../photo/pickPhoto', () => ({
  pickPhoto: vi.fn(),
  uploadPhoto: upload,
}))
vi.mock('../theme/icons', () => ({ UI_ICONS: {} }))
vi.mock('../theme/tokens', () => ({
  RADIUS: {},
  TYPE: {},
  useTokens: () => ({}),
}))

function field(uploaded: boolean) {
  const onChange = vi.fn()
  const onPreviewChange = vi.fn()
  const onBusyChange = vi.fn()
  const view = mount(
    createElement(PhotoField, {
      value: undefined,
      onChange,
      onPreviewChange,
      onBusyChange,
      generateUploadUrl: () => Promise.resolve('https://upload'),
      preset: 'memoryPhoto',
      labels: {} as never,
      initialPreview: { uri: 'file:///a.jpg', uploaded },
    }),
  )
  return { view, onChange, onPreviewChange, onBusyChange }
}

test('an uploaded photo is shown and not sent again', async () => {
  upload.mockClear()
  const { view } = field(true)
  await settle()
  expect(view.container.querySelector('img')?.getAttribute('src')).toBe(
    'file:///a.jpg',
  )
  expect(upload).not.toHaveBeenCalled()
  view.unmount()
})

test('an unfinished upload is done again, holding the form meanwhile', async () => {
  upload.mockClear()
  const { view, onChange, onPreviewChange, onBusyChange } = field(false)
  await settle()
  expect(upload).toHaveBeenCalledOnce()
  expect(onChange).toHaveBeenCalledWith('stored_1')
  expect(onPreviewChange).toHaveBeenLastCalledWith({
    uri: 'file:///a.jpg',
    uploaded: true,
  })
  expect(onBusyChange.mock.calls).toEqual([[true], [false]])
  view.unmount()
})

test('an upload whose row went is ignored, and releases the form at once', async () => {
  let land = (_: string) => {}
  upload.mockImplementationOnce(
    () =>
      new Promise<string>((done) => {
        land = done
      }),
  )
  const { view, onChange, onPreviewChange, onBusyChange } = field(false)
  await settle()
  view.unmount()
  expect(onBusyChange).toHaveBeenLastCalledWith(false)
  onPreviewChange.mockClear()
  onBusyChange.mockClear()
  land('stored_old')
  await settle()
  expect(onChange).not.toHaveBeenCalled()
  expect(onPreviewChange).not.toHaveBeenCalled()
  expect(onBusyChange).not.toHaveBeenCalled()
})
