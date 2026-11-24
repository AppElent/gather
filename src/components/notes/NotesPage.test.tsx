import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderInGroup } from '../app/testing'
import { NotePage } from './NotePage'
import { NotesPage } from './NotesPage'
import { discardDraft, IDLE } from './noteDrafts'
import { noteWhen } from './noteText'

const state = vi.hoisted(() => ({
  queries: {} as Record<string, unknown>,
  calls: [] as [string, Record<string, unknown>][],
  fail: new Set<string>(),
  navigated: [] as unknown[],
  desktop: true,
  page: {} as Record<string, unknown>,
}))

vi.mock('../../../convex/_generated/api', () => {
  const module = (name: string) =>
    new Proxy({}, { get: (_, key) => `${name}:${String(key)}` })
  return { api: new Proxy({}, { get: (_, key) => module(String(key)) }) }
})

vi.mock('@clerk/react', () => ({ useAuth: () => ({ userId: 'u1' }) }))

vi.mock('convex/react', () => ({
  useQuery: (name: string, args: unknown) => {
    if (args === 'skip') return undefined
    const answer = state.queries[name]
    return typeof answer === 'function' ? answer(args) : answer
  },
  usePaginatedQuery: () => state.page,
  useMutation: (name: string) => async (args: Record<string, unknown>) => {
    state.calls.push([name, args])
    if (state.fail.has(name)) throw new Error('nope')
    return 'new-id'
  },
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => async (to: unknown) => {
    state.navigated.push(to)
  },
  Link: ({
    children,
    to,
    params,
    search,
  }: {
    children: ReactNode
    to: string
    params?: Record<string, string>
    search?: Record<string, string>
  }) => (
    <a
      href={`${to.replace('$noteId', params?.noteId ?? '')}${search ? `?${new URLSearchParams(search)}` : ''}`}
    >
      {children}
    </a>
  ),
}))

const note = (id: string, title: string, more: object = {}) => ({
  _id: id,
  title,
  body: `${title} body\nsecond`,
  pinned: false,
  updatedAt: Date.UTC(2026, 10, 12, 12),
  updatedByName: 'Nora',
  updatedByMe: false,
  ...more,
})
const WIFI = note('n1', 'Wifi', { pinned: true })
const BOILER = note('n2', 'Boiler', { pinned: true })
const GIFTS = note('n3', 'Gifts')
const ALL = [WIFI, BOILER, GIFTS]

beforeEach(() => {
  for (const id of ['n1', 'n2', 'n3', 'n4']) discardDraft(`u1:g_household:${id}`)
  state.calls = []
  state.fail = new Set()
  state.navigated = []
  state.desktop = true
  window.matchMedia = ((query: string) => ({
    matches: state.desktop,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
  state.page = { results: [GIFTS], status: 'Exhausted', loadMore: () => {} }
  state.queries = {
    'notes:listPinned': [WIFI, BOILER],
    'notes:get': ({ noteId }: { noteId: string }) =>
      ALL.find(({ _id }) => _id === noteId) ?? null,
    'notes:searchNotes': [],
  }
})

const callsOf = (name: string) =>
  state.calls.filter(([called]) => called === name).map(([, args]) => args)
const body = () => screen.getByRole('textbox', { name: 'Start writing' })
const row = (title: string) => screen.getByRole('link', { name: title })

describe('the list', () => {
  test('shows Pinned, then Recent, each in the order the server gave', () => {
    renderInGroup(<NotesPage />)
    const rowsOf = (name: string) =>
      within(screen.getByRole('region', { name }))
        .getAllByRole('link')
        .map((link) => link.textContent)
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent),
    ).toEqual(['Pinned', 'Recent', 'Pick a note'])
    expect(rowsOf('Pinned')).toEqual(['Wifi', 'Boiler'])
    expect(rowsOf('Recent')).toEqual(['Gifts'])
    expect(screen.getByText('Nov 12 · Wifi body')).toBeInTheDocument()
    expect(screen.getByTestId('wash-summary')).toHaveTextContent(
      '3 notes · 2 pinned',
    )
  })

  test('a pin moves a note to Pinned without touching its text', async () => {
    renderInGroup(<NotesPage noteId="n3" />)
    fireEvent.click(screen.getByRole('button', { name: 'Pin note' }))
    expect(callsOf('notes:update')).toEqual([
      { noteId: 'n3', groupSlug: 'jansen-household', pinned: true },
    ])
  })

  test('a refused pin is said', async () => {
    state.fail.add('notes:update')
    renderInGroup(<NotesPage noteId="n1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Unpin note' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('nope')
  })

  test('offers the older notes while there are more', () => {
    const loadMore = vi.fn()
    state.page = { results: [GIFTS], status: 'CanLoadMore', loadMore }
    renderInGroup(<NotesPage />)
    expect(screen.getByTestId('wash-summary')).toHaveTextContent('3+ notes')
    fireEvent.click(screen.getByRole('button', { name: 'Show more notes' }))
    expect(loadMore).toHaveBeenCalled()
  })

  test('search asks the server once there are two letters', async () => {
    state.queries['notes:searchNotes'] = ({ query }: { query: string }) =>
      query === 'gi' ? [GIFTS] : []
    renderInGroup(<NotesPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Search in Notes' }))
    const field = screen.getByRole('searchbox')
    expect(field).toHaveFocus()
    fireEvent.change(field, { target: { value: 'g' } })
    expect(screen.getByText('Type at least two letters.')).toBeInTheDocument()
    fireEvent.change(field, { target: { value: 'gi' } })
    expect(await screen.findByRole('link', { name: 'Gifts' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Wifi' })).toBeNull()
    fireEvent.change(field, { target: { value: 'zz' } })
    expect(await screen.findByText('No notes found')).toBeInTheDocument()
    fireEvent.keyDown(field, { key: 'Escape' })
    expect(row('Wifi')).toBeInTheDocument()
  })

  test('no notes is an invitation, in Dutch too', () => {
    state.queries['notes:listPinned'] = []
    state.page = { results: [], status: 'Exhausted', loadMore: () => {} }
    renderInGroup(<NotesPage />, { locale: 'nl' })
    expect(screen.getByText('Nog geen notities.')).toBeInTheDocument()
  })
})

describe('the selection', () => {
  test('a row is the address of its note: in the URL on a desktop, a page below', () => {
    const { unmount } = renderInGroup(<NotesPage />)
    expect(row('Wifi')).toHaveAttribute('href', '/notes?note=n1')
    unmount()
    state.desktop = false
    renderInGroup(<NotesPage />)
    expect(row('Wifi')).toHaveAttribute('href', '/notes/n1')
  })

  test('the address opens its note, and Escape closes it onto its row', () => {
    const { rerender } = renderInGroup(<NotesPage noteId="n3" />)
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Gifts')
    body().focus()
    fireEvent.keyDown(body(), { key: 'Escape' })
    expect(state.navigated).toEqual([
      expect.objectContaining({ to: '/notes', search: {} }),
    ])
    rerender(<NotesPage />)
    expect(row('Gifts')).toHaveFocus()
  })

  test('a note that is gone says so, with a way back', () => {
    renderInGroup(<NotesPage noteId="n9" />)
    expect(screen.getByRole('heading', { name: 'Not found.' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Back to Notes' }))
    expect(state.navigated).toHaveLength(1)
  })
})

describe('the note', () => {
  test('says who changed it and that it is saved', () => {
    renderInGroup(<NotesPage noteId="n1" />)
    const status = screen.getByTestId('note-status')
    expect(status).toHaveTextContent('Saved')
    expect(status.parentElement).toHaveTextContent(
      'Edited by Nora · Nov 12 · Saved',
    )
  })

  test('typing saves after a pause, and says so', async () => {
    vi.useFakeTimers()
    try {
      renderInGroup(<NotesPage noteId="n1" />)
      fireEvent.change(body(), { target: { value: 'new text' } })
      expect(screen.getByTestId('note-status')).toHaveTextContent('Saving…')
      expect(state.calls).toEqual([])
      await act(() => vi.advanceTimersByTimeAsync(IDLE))
      expect(callsOf('notes:update')).toEqual([
        { noteId: 'n1', groupSlug: 'jansen-household', body: 'new text' },
      ])
      expect(screen.getByTestId('note-status')).toHaveTextContent('Saved')
    } finally {
      vi.useRealTimers()
    }
  })

  test('a failed save is said, and the text survives closing the note', async () => {
    state.fail.add('notes:update')
    const { rerender } = renderInGroup(<NotesPage noteId="n1" />)
    fireEvent.change(body(), { target: { value: 'mine' } })
    fireEvent.blur(body())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your text is still here. nope',
    )
    rerender(<NotesPage />)
    expect(screen.getByText('Not saved · Wifi body')).toBeInTheDocument()
    rerender(<NotesPage noteId="n1" />)
    expect(body()).toHaveValue('mine')

    state.fail.clear()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() =>
      expect(screen.getByTestId('note-status')).toHaveTextContent('Saved'),
    )
    expect(callsOf('notes:update')).toHaveLength(2)
  })

  test('unsaved text of a note somebody deleted can still be copied', async () => {
    state.fail.add('notes:update')
    const { rerender } = renderInGroup(<NotesPage noteId="n1" />)
    fireEvent.change(body(), { target: { value: 'mine' } })
    fireEvent.blur(body())
    await screen.findByRole('alert')
    state.queries['notes:get'] = null
    rerender(<NotesPage noteId="n1" />)
    expect(screen.getByLabelText('Your text that was not saved')).toHaveValue(
      'mine',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Discard text' }))
    expect(screen.queryByLabelText('Your text that was not saved')).toBeNull()
  })

  test('an emptied field of a note somebody deleted can be discarded', async () => {
    state.fail.add('notes:update')
    const { rerender } = renderInGroup(<NotesPage noteId="n1" />)
    fireEvent.change(body(), { target: { value: '' } })
    fireEvent.blur(body())
    await screen.findByRole('alert')
    state.queries['notes:get'] = null
    rerender(<NotesPage noteId="n1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Discard text' }))
    expect(screen.queryByRole('button', { name: 'Discard text' })).toBeNull()
  })

  test('another Member’s change shows, but not over unsaved text', () => {
    const { rerender } = renderInGroup(<NotesPage noteId="n1" />)
    state.queries['notes:get'] = { ...WIFI, body: 'theirs' }
    rerender(<NotesPage noteId="n1" />)
    expect(body()).toHaveValue('theirs')
    fireEvent.change(body(), { target: { value: 'mine' } })
    state.queries['notes:get'] = { ...WIFI, body: 'theirs again' }
    rerender(<NotesPage noteId="n1" />)
    expect(body()).toHaveValue('mine')
  })

  test('delete asks, deletes and closes', async () => {
    renderInGroup(<NotesPage noteId="n3" />)
    const editor = within(screen.getByTestId('note-editor'))
    fireEvent.click(editor.getByRole('button', { name: 'Actions for Gifts' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete note' }))
    expect(screen.getByRole('dialog', { name: 'Delete “Gifts”?' })).toBeVisible()
    expect(callsOf('notes:remove')).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(state.navigated).toHaveLength(1))
    expect(callsOf('notes:remove')).toEqual([
      { noteId: 'n3', groupSlug: 'jansen-household' },
    ])
  })

  test('its own page has the way back and one h1', () => {
    renderInGroup(<NotePage noteId="n1" />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(body()).toHaveValue('Wifi body\nsecond')
  })
})

describe('a new note', () => {
  test('is made empty, once, and opened', async () => {
    renderInGroup(<NotesPage />)
    const add = screen.getByRole('button', { name: 'New note' })
    fireEvent.click(add)
    fireEvent.click(add)
    await waitFor(() =>
      expect(state.navigated).toEqual([
        expect.objectContaining({ to: '/notes', search: { note: 'new-id' } }),
      ]),
    )
    expect(callsOf('notes:create')).toEqual([
      expect.objectContaining({ title: '', body: '' }),
    ])
  })

  test('a failed create is said, and a retry sends the same key', async () => {
    state.fail.add('notes:create')
    renderInGroup(<NotesPage />)
    const add = screen.getByRole('button', { name: 'New note' })
    fireEvent.click(add)
    await screen.findByRole('alert')
    state.fail.clear()
    fireEvent.click(add)
    await waitFor(() => expect(state.navigated).toHaveLength(1))
    const [first, second] = callsOf('notes:create')
    expect(second?.idempotencyKey).toBe(first?.idempotencyKey)
  })

  test('opens at its title', async () => {
    state.queries['notes:get'] = note('n4', '', { body: '' })
    const { rerender } = renderInGroup(<NotesPage />)
    rerender(<NotesPage noteId="n4" />)
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Title' })).toHaveFocus(),
    )
  })

  test('starts from Add', async () => {
    const started = vi.fn()
    renderInGroup(<NotesPage startCreating onCreateStarted={started} />)
    await waitFor(() => expect(callsOf('notes:create')).toHaveLength(1))
    expect(started).toHaveBeenCalled()
  })
})

test('noteWhen reads the day in the Group’s zone', () => {
  const now = Date.now()
  expect(noteWhen(now, 'en', 'Today', 'Europe/Amsterdam')).toMatch(/^Today /)
  expect(noteWhen(Date.UTC(2026, 0, 1, 23, 30), 'nl', 'Vandaag', 'Europe/Amsterdam')).toBe('2 jan')
  expect(noteWhen(now, 'en', 'Today', 'No/Zone')).toMatch(/^Today /)
})
