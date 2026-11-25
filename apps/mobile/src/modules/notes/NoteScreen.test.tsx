// @vitest-environment jsdom
/**
 * The note screen at a note's most characters (APP-805): text with no room is
 * said and kept, never sent, and goes with the edit that makes it fit. React
 * Native is replaced by DOM stand-ins.
 */
import { NOTE_MAX_CHARS } from '@gather/core/notes'
import { noteRefusal } from '@gather/core/refusals'
import type { ReactNode } from 'react'
import { act } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'
import { en } from '../../i18n/messages/en'
import { mount, settle } from '../../testing/dom'
import { Note } from './NoteScreen'

const state = vi.hoisted(() => ({
  note: {} as Record<string, unknown>,
  editNote: vi.fn(),
}))

vi.mock('react-native', async () => {
  const React = await import('react')
  const h = React.createElement
  type Props = Record<string, unknown> & { children?: ReactNode }
  const dom =
    (tag: string) =>
    ({ children, testID }: Props) =>
      h(tag, { 'data-testid': testID as string | undefined }, children)
  return {
    View: dom('div'),
    Text: dom('span'),
    Pressable: dom('button'),
    ScrollView: dom('div'),
    KeyboardAvoidingView: dom('div'),
    Platform: { OS: 'ios' },
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
    TextInput: ({ testID, value, onChangeText, onBlur }: Props) =>
      h('textarea', {
        'data-testid': testID,
        value,
        onChange: (event: { target: { value: string } }) =>
          (onChangeText as (next: string) => void)(event.target.value),
        onBlur,
      }),
  }
})
vi.mock('@clerk/expo', () => ({ useAuth: () => ({ userId: 'u1' }) }))
vi.mock('@expo/ui/community/menu', () => ({ MenuView: () => null }))
vi.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ back: () => {} }),
}))
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}))
vi.mock('../../feedback/haptics', () => ({ haptics: {} }))
vi.mock('../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { _id: 'g1' } }),
}))
vi.mock('../../i18n', async () => {
  const { en: t } = await import('../../i18n/messages/en')
  const { fmt } = await import('@gather/core/i18n')
  return { fmt, useI18n: () => ({ t, locale: 'en' }) }
})
vi.mock('../../search/recentRecordsStore', () => ({
  useRecordRecent: () => {},
}))
vi.mock('../../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../../theme/tokens', () => ({
  RADIUS: {},
  TABULAR: {},
  TYPE: new Proxy({}, { get: () => ({}) }),
  useTokens: () => new Proxy({}, { get: (_, key) => String(key) }),
}))
vi.mock('./notesActions', () => ({ confirmDeleteNote: () => {} }))
vi.mock('./store', () => ({
  useNote: () => state.note,
  useNoteActions: () => ({ editNote: state.editNote }),
}))

const TOO_LONG = en.notes.refusals['notes:too-long']
const full = 'a'.repeat(NOTE_MAX_CHARS)
let id = 0

function open(note: { title?: string; body?: string }) {
  id += 1
  state.note = {
    id: `n${id}`,
    title: '',
    body: '',
    pinned: false,
    updatedAt: 1,
    updatedByName: null,
    updatedByMe: true,
    ...note,
  }
  return mount(<Note noteId={`n${id}`} />)
}
const find = (view: { container: HTMLElement }, testId: string) =>
  view.container.querySelector<HTMLTextAreaElement>(`[data-testid="${testId}"]`)
async function type(
  view: { container: HTMLElement },
  testId: string,
  text: string,
) {
  const field = find(view, testId) as HTMLTextAreaElement
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )?.set?.call(field, text)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  act(() => {
    field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
  })
  await settle()
}

beforeEach(() => {
  state.editNote.mockReset().mockResolvedValue(undefined)
})

test('a note with room shows no counter; near the limit it does', () => {
  const small = open({ body: 'hello' })
  expect(find(small, 'note-length')).toBeNull()
  small.unmount()
  const near = open({ body: 'a'.repeat(95_000) })
  expect(find(near, 'note-length')?.textContent).toBe(
    '95,000 of 100,000 characters',
  )
  expect(find(near, 'note-problem')).toBeNull()
  near.unmount()
})

test('text with no room is refused on screen and not sent, until it fits', async () => {
  const view = open({ title: 'T', body: 'b' })
  await type(view, 'note-body', full)
  expect(find(view, 'note-problem')?.textContent).toBe(TOO_LONG)
  expect(state.editNote).not.toHaveBeenCalled()
  await type(view, 'note-title', '')
  expect(find(view, 'note-problem')).toBeNull()
  expect(state.editNote).toHaveBeenCalledWith(state.note.id, {
    title: '',
    body: full,
  })
  view.unmount()
})

test('refused text is kept for when the note is opened again', async () => {
  const view = open({ title: 'T', body: 'b' })
  await type(view, 'note-body', full)
  view.unmount()
  const again = mount(<Note noteId={state.note.id as string} />)
  expect(find(again, 'note-body')?.value).toBe(full)
  expect(find(again, 'note-problem')?.textContent).toBe(TOO_LONG)
  again.unmount()
})

test('a note already over the limit opens without an error, and can be shortened', async () => {
  const view = open({ title: 'T', body: `${full}x` })
  expect(find(view, 'note-problem')).toBeNull()
  expect(find(view, 'note-length')).not.toBeNull()
  await type(view, 'note-body', full)
  expect(find(view, 'note-problem')?.textContent).toBe(TOO_LONG)
  expect(state.editNote).not.toHaveBeenCalled()
  await type(view, 'note-body', 'short')
  expect(state.editNote).toHaveBeenCalledWith(state.note.id, { body: 'short' })
  view.unmount()
})

test('a refusal from the server is shown, and does not crash', async () => {
  state.editNote.mockRejectedValue({ data: noteRefusal('too-long') })
  const view = open({ title: 'T', body: 'b' })
  await type(view, 'note-body', 'c')
  expect(find(view, 'note-problem')?.textContent).toBe(TOO_LONG)
  view.unmount()
})

test('text sent with the other field is saved, and never sent again', async () => {
  const view = open({ title: 'T', body: 'b' })
  const id = state.note.id as string
  await type(view, 'note-body', full)
  await type(view, 'note-title', '')
  // Someone else changes the body after it landed; leaving must not undo that.
  state.note = { ...state.note, title: '', body: full }
  view.rerender(<Note noteId={id} />)
  state.note = { ...state.note, body: 'theirs' }
  view.rerender(<Note noteId={id} />)
  expect(find(view, 'note-body')?.value).toBe('theirs')
  view.unmount()
  expect(state.editNote).toHaveBeenCalledTimes(1)
})

test('leaving before the save shows up keeps no draft of it', async () => {
  const view = open({ title: 'T', body: 'b' })
  const id = state.note.id as string
  await type(view, 'note-body', full)
  await type(view, 'note-title', '')
  view.unmount()
  expect(state.editNote).toHaveBeenCalledTimes(1)
  state.note = { ...state.note, title: '', body: 'theirs' }
  const again = mount(<Note noteId={id} />)
  expect(find(again, 'note-body')?.value).toBe('theirs')
  again.unmount()
  expect(state.editNote).toHaveBeenCalledTimes(1)
})

test('kept refused text does not go over a change made since', async () => {
  const view = open({ title: 'T', body: 'b' })
  const id = state.note.id as string
  await type(view, 'note-body', full)
  view.unmount()
  state.note = { ...state.note, title: '', body: 'theirs' }
  const again = mount(<Note noteId={id} />)
  expect(find(again, 'note-body')?.value).toBe('theirs')
  again.unmount()
  expect(state.editNote).not.toHaveBeenCalled()
})

test('text the server refused stays over a change from elsewhere', async () => {
  state.editNote.mockRejectedValue({ data: noteRefusal('too-long') })
  const view = open({ title: 'T', body: 'b' })
  await type(view, 'note-body', 'mine')
  state.note = { ...state.note, body: 'theirs' }
  view.rerender(<Note noteId={state.note.id as string} />)
  expect(find(view, 'note-body')?.value).toBe('mine')
  view.unmount()
})
