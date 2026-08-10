import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { TaskListBackendView } from '../../../convex/taskLists'
import { renderWithI18n } from '../../lib/i18n/testing'
import { TaskListCard } from './TaskListCard'

/**
 * One card renders every list, and what it offers comes from the Backend's
 * capability list rather than from which provider it is (ADR-0014).
 *
 * These tests are about what a Member is offered, not about how it is wired:
 * a control that the Backend cannot support must be absent, and a stale
 * external list must still show its tasks while offering none of them.
 */

const state = vi.hoisted(() => ({
  backend: null as TaskListBackendView | null,
  tasks: [] as unknown[],
  calls: {} as Record<string, unknown[]>,
}))

vi.mock('convex/react', () => ({
  useQuery: (name: string) =>
    name === 'taskLists:backend' ? state.backend : state.tasks,
  useMutation: (name: string) => async (args: unknown) => {
    state.calls[name] = [...(state.calls[name] ?? []), args]
  },
  useAction: (name: string) => async (args: unknown) => {
    state.calls[name] = [...(state.calls[name] ?? []), args]
    return { status: 'ok', added: 0, updated: 0, deleted: 0 }
  },
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    taskLists: { backend: 'taskLists:backend', refresh: 'taskLists:refresh' },
    tasks: {
      listByList: 'tasks:listByList',
      add: 'tasks:add',
      update: 'tasks:update',
      toggleDone: 'tasks:toggleDone',
      remove: 'tasks:remove',
      move: 'tasks:move',
    },
  },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
}))

const ALL = {
  create: true,
  edit: true,
  complete: true,
  delete: true,
  reorder: true,
  subtasks: true,
  priority: true,
  labels: true,
  dueDate: true,
}
const NONE = {
  ...ALL,
  create: false,
  edit: false,
  complete: false,
  delete: false,
  reorder: false,
  subtasks: false,
}

const localBackend: TaskListBackendView = {
  provider: 'local',
  capabilities: ALL,
  source: null,
  sync: null,
  readOnly: false,
}

function externalBackend(
  over: Partial<TaskListBackendView> = {},
): TaskListBackendView {
  return {
    provider: 'todoist',
    capabilities: NONE,
    source: {
      connectionId: 'conn_1' as never,
      accountLabel: 'household@example.com',
      connectionStatus: 'connected',
      sourceId: 'p1',
      sourceName: 'Household',
    },
    sync: { lastSyncedAt: 1, neverSynced: false, state: 'ready' },
    readOnly: false,
    ...over,
  }
}

const task = { _id: 't1', title: 'Water plants', done: false, order: 0 }

beforeEach(() => {
  state.backend = localBackend
  state.tasks = [task]
  state.calls = {}
})

function renderCard() {
  renderWithI18n(
    <TaskListCard
      listId={'list_1' as never}
      groupSlug="jansen-household"
      name="Household"
      onRemoveList={() => {}}
    />,
  )
}

describe('a local list', () => {
  test('offers everything, and adds through the list it is in', async () => {
    renderCard()

    fireEvent.change(screen.getByLabelText(/new task in household/i), {
      target: { value: 'Buy milk' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^add task$/i }))

    await waitFor(() => {
      expect(state.calls['tasks:add']).toEqual([
        {
          listId: 'list_1',
          groupSlug: 'jansen-household',
          title: 'Buy milk',
        },
      ])
    })
    expect(screen.getByRole('checkbox')).toBeEnabled()
    expect(
      screen.getByRole('button', { name: /edit water plants/i }),
    ).toBeInTheDocument()
    // Nothing to refresh: a local list is already what it is.
    expect(
      screen.queryByRole('button', { name: /refresh household/i }),
    ).toBeNull()
  })
})

describe('a read-only external list', () => {
  beforeEach(() => {
    state.backend = externalBackend()
  })

  test('shows the tasks and none of the controls that would change them', () => {
    renderCard()

    expect(screen.getByText('Water plants')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeDisabled()
    for (const name of [
      /edit water plants/i,
      /delete water plants/i,
      /^add task$/i,
    ]) {
      expect(screen.queryByRole('button', { name })).toBeNull()
    }
    // …and says why, rather than leaving the reader to conclude gather is
    // broken.
    expect(screen.getByText(/edited in todoist/i)).toBeInTheDocument()
  })

  test('names the account and the source it is reading', () => {
    renderCard()
    expect(
      screen.getByText(/Household · household@example.com/),
    ).toBeInTheDocument()
  })

  test('refreshes when asked', async () => {
    renderCard()

    fireEvent.click(screen.getByRole('button', { name: /refresh household/i }))

    await waitFor(() => {
      expect(state.calls['taskLists:refresh']).toEqual([
        { listId: 'list_1', groupSlug: 'jansen-household' },
      ])
    })
  })

  test('fetches once when opened for the first time, and not again', async () => {
    state.backend = externalBackend({
      sync: { lastSyncedAt: null, neverSynced: true, state: 'ready' },
    })
    state.tasks = []
    renderCard()

    await waitFor(() => {
      expect(state.calls['taskLists:refresh']).toHaveLength(1)
    })
  })
})

describe('an external list the provider is not answering', () => {
  test('keeps its tasks on screen, explicitly stale and read-only', () => {
    state.backend = externalBackend({
      capabilities: ALL,
      readOnly: true,
      sync: { lastSyncedAt: 1, neverSynced: false, state: 'stale' },
    })
    renderCard()

    // The last thing Todoist said is worth reading; changing it is not on
    // offer, because nothing authoritative would agree to the change.
    expect(screen.getByText('Water plants')).toBeInTheDocument()
    expect(screen.getByText(/could not reach todoist/i)).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeDisabled()
    expect(screen.queryByRole('button', { name: /^add task$/i })).toBeNull()
  })

  test('points a disconnected list at the Group settings that can fix it', () => {
    state.backend = externalBackend({
      readOnly: true,
      source: {
        connectionId: 'conn_1' as never,
        accountLabel: 'household@example.com',
        connectionStatus: 'disconnected',
        sourceId: 'p1',
        sourceName: 'Household',
      },
      sync: { lastSyncedAt: 1, neverSynced: false, state: 'reconnect' },
    })
    renderCard()

    expect(screen.getByText(/is disconnected/i)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /group settings/i }),
    ).toBeInTheDocument()
  })
})
