// @vitest-environment jsdom
/** The note composer and a note with no room (APP-805): nothing is sent. */
import { NOTE_MAX_CHARS } from '@gather/core/notes'
import { noteRefusal } from '@gather/core/refusals'
import { act } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'
import { en } from '../../i18n/messages/en'
import { mount, settle } from '../../testing/dom'
import { AddNote } from './AddNoteComposer'

interface Card {
  onSave: () => void
  notice: string | null
  body: { value: string; onChange: (next: string) => void }
}
const state = vi.hoisted(() => ({
  card: null as unknown,
  open: () => {},
  create: vi.fn(),
  alert: vi.fn(),
}))
const card = () => state.card as Card

vi.mock('react-native', () => ({ TextInput: () => null }))
vi.mock('@clerk/expo', () => ({ useAuth: () => ({ userId: 'u1' }) }))
vi.mock('../../feedback/haptics', () => ({
  haptics: { actionFailed: () => {}, itemSaved: () => {} },
}))
vi.mock('../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { _id: 'g1' } }),
}))
vi.mock('../../i18n', async () => {
  const { en: t } = await import('../../i18n/messages/en')
  const { fmt } = await import('@gather/core/i18n')
  return { fmt, useI18n: () => ({ t, locale: 'en' }) }
})
vi.mock('../../observability/native-presentation', () => ({
  showAlert: state.alert,
}))
vi.mock('../../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../../ui/keyboard-composer', () => ({
  ComposerAddButton: ({ onPress }: { onPress: () => void }) => {
    state.open = onPress
    return null
  },
  KeyboardComposer: (props: unknown) => {
    state.card = props
    return null
  },
}))
vi.mock('./store', () => ({
  useNoteActions: () => ({ addComposedNote: state.create }),
}))

const TOO_LONG = en.notes.refusals['notes:too-long']

beforeEach(() => {
  state.create.mockReset()
  state.alert.mockReset()
})

async function save(body: string) {
  const view = mount(<AddNote />)
  act(() => state.open())
  act(() => card().body.onChange(body))
  act(() => card().onSave())
  await settle()
  return view
}

test('a note that is too long stays in the composer, with the reason', async () => {
  const body = 'a'.repeat(NOTE_MAX_CHARS + 1)
  const view = await save(body)
  expect(card().notice).toBe(TOO_LONG)
  expect(card().body.value).toBe(body)
  expect(state.create).not.toHaveBeenCalled()
  act(() => card().body.onChange(''))
  view.unmount()
})

test("the server's refusal is the alert's reason", async () => {
  state.create.mockRejectedValue({ data: noteRefusal('too-long') })
  const view = await save('short')
  expect(card().notice).toBe(TOO_LONG)
  expect(state.alert.mock.calls[0][1]).toBe(TOO_LONG)
  view.unmount()
})
