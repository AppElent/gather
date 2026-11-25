import type { BabyEventType } from '@gather/core/domain'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { getFunctionName } from 'convex/server'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { renderWithI18n } from '../../lib/i18n/testing'
import { stubImagePipeline } from '../photo/testing'
import { EventForm } from './EventForm'

const calls = vi.hoisted(() => ({
  'babyEvents:add': vi.fn(),
  'babyEvents:update': vi.fn(),
  'babies:generateUploadUrl': vi.fn(),
}))
const add = calls['babyEvents:add']
const update = calls['babyEvents:update']

vi.mock('convex/react', () => ({
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) =>
    calls[getFunctionName(ref) as keyof typeof calls],
}))

const memory = {
  _id: 'event1' as Id<'babyEvents'>,
  _creationTime: 0,
  babyId: 'baby1' as Id<'babies'>,
  type: 'memory',
  timestamp: 1_760_000_000_000,
  loggedBy: 'user1' as Id<'users'>,
  data: { what: 'First laugh' },
  photoId: 'old' as Id<'_storage'>,
  photoUrl: 'https://x/old',
} as Doc<'babyEvents'> & { photoUrl: string }

let finishUpload: (ok: boolean) => void

beforeEach(() => {
  vi.resetAllMocks()
  calls['babies:generateUploadUrl'].mockResolvedValue('https://x/upload')
  stubImagePipeline()
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise((resolve) => {
          finishUpload = (ok) =>
            resolve({ ok, json: async () => ({ storageId: 'new' }) })
        }),
    ),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function renderForm(type: BabyEventType, event?: typeof memory) {
  return renderWithI18n(
    <EventForm
      babyId={memory.babyId}
      groupSlug="jansen-household"
      type={type}
      event={event}
      onDone={vi.fn()}
      onCancel={vi.fn()}
    />,
  )
}

const saveButton = () => screen.getByRole('button', { name: 'Save' })

async function startUpload() {
  fireEvent.change(screen.getByLabelText('Photo'), {
    target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] },
  })
  fireEvent.click(await screen.findByRole('button', { name: 'Use photo' }))
  await waitFor(() => expect(fetch).toHaveBeenCalled())
}

test('a type that offers no photo on the phone offers none here', () => {
  renderForm('note')
  expect(screen.queryByLabelText('Photo')).toBeNull()
})

test('a new Memory waits for its photo and saves with it', async () => {
  renderForm('memory')
  fireEvent.change(screen.getByRole('textbox', { name: /What/ }), {
    target: { value: 'First laugh' },
  })
  await startUpload()
  expect(saveButton()).toBeDisabled()

  finishUpload(true)
  await waitFor(() => expect(saveButton()).toBeEnabled())
  fireEvent.click(saveButton())

  await waitFor(() => expect(add).toHaveBeenCalled())
  expect(add.mock.calls[0][0]).toMatchObject({ photoId: 'new' })
})

test('a failed upload still lets the Memory save without a photo', async () => {
  renderForm('memory', memory)
  await startUpload()
  finishUpload(false)
  await waitFor(() => expect(saveButton()).toBeEnabled())
  fireEvent.click(saveButton())

  await waitFor(() => expect(update).toHaveBeenCalled())
  expect(update.mock.calls[0][0].photoId).toBeUndefined()
})

test('an edit that leaves the photo alone sends none', async () => {
  renderForm('memory', memory)
  fireEvent.click(saveButton())

  await waitFor(() => expect(update).toHaveBeenCalled())
  expect(update.mock.calls[0][0].photoId).toBeUndefined()
})

test('an edit replaces the photo', async () => {
  renderForm('memory', memory)
  await startUpload()
  finishUpload(true)
  await waitFor(() => expect(saveButton()).toBeEnabled())
  fireEvent.click(saveButton())

  await waitFor(() => expect(update).toHaveBeenCalled())
  expect(update.mock.calls[0][0].photoId).toBe('new')
})

test('an edit removes the photo', async () => {
  renderForm('memory', memory)
  fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }))
  expect(screen.queryByRole('button', { name: 'Remove photo' })).toBeNull()
  fireEvent.click(saveButton())

  await waitFor(() => expect(update).toHaveBeenCalled())
  expect(update.mock.calls[0][0].photoId).toBeNull()
})
