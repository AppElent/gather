import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { DataExportSettings } from './DataExportSettings'

const query = vi.fn()
vi.mock('convex/react', () => ({ useConvex: () => ({ query }) }))

afterEach(() => {
  vi.restoreAllMocks()
  query.mockReset()
})

/** A server with one account table and no Groups. */
function serve() {
  query.mockImplementation(async (_fn, args: { table?: string }) =>
    args.table
      ? { rows: [{ id: 'u1', name: 'Alice' }], cursor: null, isDone: true }
      : {
          version: 1,
          account: ['users'],
          group: [],
          excluded: [],
          omittedFields: {},
          groups: [],
        },
  )
}

test('says what the file holds back before offering it', () => {
  renderWithI18n(<DataExportSettings />)
  expect(screen.getByText('Export your data')).toBeDefined()
  expect(screen.getByText(/Other members appear by name only/)).toBeDefined()
  expect(screen.getByText(/Photos are included as links/)).toBeDefined()
})

test('downloads the assembled file', async () => {
  serve()
  const blobs: Blob[] = []
  URL.createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob)
    return 'blob:export'
  })
  URL.revokeObjectURL = vi.fn()
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {})

  renderWithI18n(<DataExportSettings />)
  fireEvent.click(screen.getByRole('button', { name: 'Export' }))

  await waitFor(() => expect(click).toHaveBeenCalled())
  const file = JSON.parse(await blobs[0].text())
  expect(file.format).toBe('gather.data-export')
  expect(file.account.users).toEqual([{ id: 'u1', name: 'Alice' }])
})

test('says so when the export fails', async () => {
  query.mockRejectedValue(new Error('offline'))
  renderWithI18n(<DataExportSettings />)
  fireEvent.click(screen.getByRole('button', { name: 'Export' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not export your data. Try again.',
  )
})
