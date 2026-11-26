// @vitest-environment jsdom
/**
 * The note screen at a note's most characters (APP-805): text with no room is
 * said and kept, never sent, and goes with the edit that makes it fit. Text a
 * person typed is never dropped without a word (APP-829). React Native is
 * replaced by DOM stand-ins.
 */
import { NOTE_MAX_CHARS } from '@gather/core/notes'
import { noteRefusal } from '@gather/core/refusals'
import type { ReactNode } from 'react'
import { act } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'
import { en } from '../../i18n/messages/en'
import { mount, settle } from '../../testing/dom'
import {
  forgetHeldMemoryForTests,
  forgetHeldNotes,
  readHeld,
  setHeldStoreForTests,
} from './heldText'
import { Note } from './NoteScreen'

const state = vi.hoisted(() => ({
  note: {} as Record<string, unknown>,
  editNote: vi.fn(),
  reported: [] as unknown[],
  disk: new Map<string, string>(),
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
    Pressable: ({ children, testID, onPress }: Props) =>
      h(
        'button',
        { 'data-testid': testID as string | undefined, onClick: onPress },
        children,
      ),
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
vi.mock('../../observability/report', () => ({
  reportError: (error: unknown) => state.reported.push(error),
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

const disk = {
  getItemSync: (key: string) => state.disk.get(key) ?? null,
  setItemSync: (key: string, value: string) => {
    state.disk.set(key, value)
  },
  removeItemSync: (key: string) => state.disk.delete(key),
  getAllKeysSync: () => [...state.disk.keys()],
}

beforeEach(() => {
  state.editNote.mockReset().mockResolvedValue(undefined)
  state.reported = []
  setHeldStoreForTests(disk as never)
  forgetHeldNotes()
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

/** A save that has not answered yet, settled by the test. */
function deferred() {
  let resolve = () => {}
  let reject = (_error: unknown) => {}
  const promise = new Promise<void>((yes, no) => {
    resolve = () => yes()
    reject = no
  })
  return { promise, resolve, reject }
}
const tap = async (view: { container: HTMLElement }, testId: string) => {
  act(() => (find(view, testId) as unknown as HTMLElement).click())
  await settle()
}
const blur = async (view: { container: HTMLElement }, testId: string) => {
  act(() => {
    find(view, testId)?.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true }),
    )
  })
  await settle()
}

// APP-829, edge case 1.
test('refused text outlives a quit: it is on the phone, not only in memory', async () => {
  const view = open({ title: 'T', body: 'b' })
  const id = state.note.id as string
  await type(view, 'note-body', full)
  // A quit unmounts nothing: what is held is already on the phone.
  forgetHeldMemoryForTests()
  const again = mount(<Note noteId={id} />)
  expect(find(again, 'note-body')?.value).toBe(full)
  expect(find(again, 'note-problem')?.textContent).toBe(TOO_LONG)
  again.unmount()
  view.unmount()
})

// APP-829, edge case 2.
test('refused text comes back on a reopen before an earlier save landed', async () => {
  const landing = deferred()
  state.editNote.mockReturnValue(landing.promise)
  const view = open({ title: 'T', body: 'b' })
  const id = state.note.id as string
  await type(view, 'note-body', 'short')
  expect(state.editNote).toHaveBeenCalledWith(id, { body: 'short' })
  await type(view, 'note-body', full)
  view.unmount()
  // The note still has the old body: 'short' has not landed.
  const early = mount(<Note noteId={id} />)
  expect(find(early, 'note-body')?.value).toBe(full)
  expect(find(early, 'note-problem')?.textContent).toBe(TOO_LONG)
  early.unmount()
  // It lands; the next open still has the refused text.
  landing.resolve()
  await settle()
  state.note = { ...state.note, body: 'short' }
  const later = mount(<Note noteId={id} />)
  expect(find(later, 'note-body')?.value).toBe(full)
  expect(find(later, 'note-clash')).toBeNull()
  later.unmount()
})

// APP-829, edge case 3.
test('kept text over a field changed since is offered, kept, and put back on request', async () => {
  const view = open({ title: 'T', body: 'b' })
  const id = state.note.id as string
  await type(view, 'note-body', full)
  view.unmount()
  state.note = { ...state.note, body: 'theirs' }
  const again = mount(<Note noteId={id} />)
  expect(find(again, 'note-body')?.value).toBe('theirs')
  expect(find(again, 'note-clash')?.textContent).toBe(
    en.notes.keptNotPutBack,
  )
  again.unmount()
  // Not chosen: still kept, still said.
  forgetHeldMemoryForTests()
  const third = mount(<Note noteId={id} />)
  expect(find(third, 'note-clash')).not.toBeNull()
  await tap(third, 'note-put-back')
  expect(find(third, 'note-body')?.value).toBe(full)
  expect(find(third, 'note-clash')).toBeNull()
  expect(find(third, 'note-problem')?.textContent).toBe(TOO_LONG)
  third.unmount()
  expect(state.editNote).not.toHaveBeenCalled()
})

test('kept text is gone only when discarded', async () => {
  const view = open({ title: 'T', body: 'b' })
  const id = state.note.id as string
  await type(view, 'note-body', full)
  view.unmount()
  state.note = { ...state.note, body: 'theirs' }
  const again = mount(<Note noteId={id} />)
  await tap(again, 'note-discard-kept')
  expect(find(again, 'note-clash')).toBeNull()
  again.unmount()
  forgetHeldMemoryForTests()
  const third = mount(<Note noteId={id} />)
  expect(find(third, 'note-clash')).toBeNull()
  expect(find(third, 'note-body')?.value).toBe('theirs')
  third.unmount()
})

// APP-829, edge case 4.
test('leaving before the note loads keeps the kept text', async () => {
  const view = open({ title: 'T', body: 'b' })
  const note = state.note
  await type(view, 'note-body', full)
  view.unmount()
  state.note = undefined as never
  const loading = mount(<Note noteId={note.id as string} />)
  loading.unmount()
  state.note = note
  const again = mount(<Note noteId={note.id as string} />)
  expect(find(again, 'note-body')?.value).toBe(full)
  again.unmount()
})

// APP-829, edge case 5.
test('text whose save failed is said, sent again on leaving, and kept if that fails too', async () => {
  const offline = new Error('offline')
  state.editNote.mockRejectedValue(offline)
  const view = open({ title: 'T', body: 'b' })
  const id = state.note.id as string
  await type(view, 'note-body', 'c')
  expect(find(view, 'note-problem')?.textContent).toBe(en.notes.notSaved)
  expect(find(view, 'note-body')?.value).toBe('c')
  expect(state.reported).toEqual([offline])
  view.unmount()
  await settle()
  expect(state.editNote).toHaveBeenCalledTimes(2)
  expect(state.editNote).toHaveBeenLastCalledWith(id, { body: 'c' })
  // Back online: reopened, it is put back and sent.
  state.editNote.mockReset().mockResolvedValue(undefined)
  forgetHeldMemoryForTests()
  const again = mount(<Note noteId={id} />)
  expect(find(again, 'note-body')?.value).toBe('c')
  await blur(again, 'note-body')
  expect(state.editNote).toHaveBeenCalledWith(id, { body: 'c' })
  state.note = { ...state.note, body: 'c' }
  again.rerender(<Note noteId={id} />)
  again.unmount()
  forgetHeldMemoryForTests()
  const done = mount(<Note noteId={id} />)
  expect(find(done, 'note-body')?.value).toBe('c')
  expect(find(done, 'note-problem')).toBeNull()
  done.unmount()
  expect(state.disk.size).toBe(0)
})

// APP-829, edge case 6.
test('a refusal that arrives after the note was reopened is shown there, and kept', async () => {
  const answer = deferred()
  state.editNote.mockReturnValueOnce(answer.promise)
  const view = open({ title: 'T', body: 'b' })
  const id = state.note.id as string
  await type(view, 'note-body', 'c')
  view.unmount()
  // Still on its way, so kept: the reopened screen has it already.
  const again = mount(<Note noteId={id} />)
  expect(find(again, 'note-body')?.value).toBe('c')
  expect(find(again, 'note-problem')).toBeNull()
  answer.reject({ data: noteRefusal('too-long') })
  await settle()
  expect(find(again, 'note-body')?.value).toBe('c')
  expect(find(again, 'note-problem')?.textContent).toBe(TOO_LONG)
  // Its own close sends it again; refused again, it is still kept.
  state.editNote.mockRejectedValue({ data: noteRefusal('too-long') })
  again.unmount()
  await settle()
  forgetHeldMemoryForTests()
  const third = mount(<Note noteId={id} />)
  expect(find(third, 'note-body')?.value).toBe('c')
  third.unmount()
  await settle()
})

test('typing in a field the late text was meant for keeps the typing, and offers the text', async () => {
  const answer = deferred()
  state.editNote.mockReturnValueOnce(answer.promise)
  const view = open({ title: 'T', body: 'b' })
  const id = state.note.id as string
  await type(view, 'note-body', 'c')
  view.unmount()
  state.editNote.mockReturnValue(new Promise(() => {}))
  const again = mount(<Note noteId={id} />)
  await type(again, 'note-body', 'typed since')
  answer.reject({ data: noteRefusal('too-long') })
  await settle()
  expect(find(again, 'note-body')?.value).toBe('typed since')
  expect(find(again, 'note-clash')).not.toBeNull()
  again.unmount()
})

test('signing out forgets every note\'s kept text', async () => {
  const view = open({ title: 'T', body: 'b' })
  await type(view, 'note-body', full)
  view.unmount()
  expect(state.disk.size).toBe(1)
  forgetHeldNotes()
  expect(state.disk.size).toBe(0)
})

// Review round 1, blocker 1: after a quit the note is not cached, so it loads
// after the screen mounted, while the fields are still empty.
test('kept text is put back when the note loads after the screen opened', async () => {
  const view = open({ title: 'T', body: 'b' })
  const note = state.note
  await type(view, 'note-body', full)
  view.unmount()
  forgetHeldMemoryForTests()
  state.note = undefined as never
  const again = mount(<Note noteId={note.id as string} />)
  state.note = note
  again.rerender(<Note noteId={note.id as string} />)
  await settle()
  expect(find(again, 'note-body')?.value).toBe(full)
  expect(find(again, 'note-clash')).toBeNull()
  expect(find(again, 'note-problem')?.textContent).toBe(TOO_LONG)
  again.unmount()
})

// Review round 1, blocker 2.
test('a note open at sign-out writes nothing back, and neither does a late answer', async () => {
  const answer = deferred()
  state.editNote.mockReturnValueOnce(answer.promise)
  const view = open({ title: 'T', body: 'b' })
  await type(view, 'note-title', 'sent')
  await type(view, 'note-body', full)
  expect(state.disk.size).toBe(1)
  forgetHeldNotes()
  view.unmount()
  answer.reject({ data: noteRefusal('too-long') })
  await settle()
  expect(state.disk.size).toBe(0)
  expect(readHeld(`u1:g1:notes:${state.note.id}`)).toBeUndefined()
})

test('text whose save is still on its way when the note closes is kept until it lands', async () => {
  const answer = deferred()
  state.editNote.mockReturnValueOnce(answer.promise)
  const view = open({ title: 'T', body: 'b' })
  const id = state.note.id as string
  await type(view, 'note-body', 'c')
  view.unmount()
  expect(readHeld(`u1:g1:notes:${id}`)?.body?.text).toBe('c')
  answer.resolve()
  await settle()
  expect(readHeld(`u1:g1:notes:${id}`)).toBeUndefined()
  expect(state.disk.size).toBe(0)
})
