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
  actionResult: { status: 'ok' } as { status: string },
  actionFails: false,
}))

vi.mock('convex/react', () => ({
  useQuery: (name: string) =>
    name === 'taskLists:backend' ? state.backend : state.tasks,
  useMutation: (name: string) => async (args: unknown) => {
    state.calls[name] = [...(state.calls[name] ?? []), args]
  },
  useAction: (name: string) => async (args: unknown) => {
    state.calls[name] = [...(state.calls[name] ?? []), args]
    if (name === 'taskLists:refresh') {
      return { status: 'ok', added: 0, updated: 0, deleted: 0 }
    }
    if (state.actionFails) throw new Error('provider refused')
    return state.actionResult
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
      reparent: 'tasks:reparent',
    },
    externalTasks: {
      create: 'externalTasks:create',
      update: 'externalTasks:update',
      setDone: 'externalTasks:setDone',
      remove: 'externalTasks:remove',
      move: 'externalTasks:move',
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
    sync: {
      lastSyncedAt: 1,
      neverSynced: false,
      state: 'ready',
      pendingReconciliation: false,
    },
    readOnly: false,
    ...over,
  }
}

const task = { _id: 't1', title: 'Water plants', done: false, order: 0 }

beforeEach(() => {
  state.backend = localBackend
  state.tasks = [task]
  state.calls = {}
  state.actionResult = { status: 'ok' }
  state.actionFails = false
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
      sync: {
        lastSyncedAt: null,
        neverSynced: true,
        state: 'ready',
        pendingReconciliation: false,
      },
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
      sync: {
        lastSyncedAt: 1,
        neverSynced: false,
        state: 'stale',
        pendingReconciliation: false,
      },
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
      sync: {
        lastSyncedAt: 1,
        neverSynced: false,
        state: 'reconnect',
        pendingReconciliation: false,
      },
    })
    renderCard()

    expect(screen.getByText(/is disconnected/i)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /group settings/i }),
    ).toBeInTheDocument()
  })
})

describe('a writable external list', () => {
  beforeEach(() => {
    state.backend = externalBackend({
      capabilities: { ...ALL, reorder: false },
    })
  })

  test('sends every write through the provider-first path', async () => {
    renderCard()

    fireEvent.change(screen.getByLabelText(/new task in household/i), {
      target: { value: 'Buy milk' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^add task$/i }))
    await waitFor(() => {
      expect(state.calls['externalTasks:create']).toEqual([
        {
          listId: 'list_1',
          groupSlug: 'jansen-household',
          title: 'Buy milk',
          dueDate: undefined,
          priority: undefined,
          labels: undefined,
        },
      ])
    })
    // Never the local mutation: a cached row is not this app's to write.
    expect(state.calls['tasks:add']).toBeUndefined()

    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => {
      expect(state.calls['externalTasks:setDone']).toEqual([
        { taskId: 't1', groupSlug: 'jansen-household', done: true },
      ])
    })

    fireEvent.click(
      screen.getByRole('button', { name: /delete water plants/i }),
    )
    await waitFor(() => {
      expect(state.calls['externalTasks:remove']).toEqual([
        { taskId: 't1', groupSlug: 'jansen-household' },
      ])
    })
  })

  test('does not offer to reorder a list whose order is the provider’s', () => {
    renderCard()
    expect(
      screen.queryByRole('button', { name: /move water plants up/i }),
    ).toBeNull()
  })

  test('reports a provider-accepted write the cache missed as saved, not failed', async () => {
    state.actionResult = { status: 'savedRemotely' }
    renderCard()

    fireEvent.click(screen.getByRole('checkbox'))

    // "Saved in Todoist" rather than an error: telling the reader it failed
    // would invite them to send it a second time.
    await waitFor(() => {
      expect(screen.getByText(/saved in todoist/i)).toBeInTheDocument()
    })
    expect(
      screen.getByRole('button', { name: /refresh now/i }),
    ).toBeInTheDocument()
  })

  test('says plainly when a write did not happen at all', async () => {
    state.actionFails = true
    renderCard()

    fireEvent.click(screen.getByRole('checkbox'))

    await waitFor(() => {
      expect(screen.getByText(/was not saved/i)).toBeInTheDocument()
    })
  })

  test('carries a list already marked for reconciliation', () => {
    state.backend = externalBackend({
      capabilities: { ...ALL, reorder: false },
      sync: {
        lastSyncedAt: 1,
        neverSynced: false,
        state: 'ready',
        pendingReconciliation: true,
      },
    })
    renderCard()
    expect(screen.getByText(/saved in todoist/i)).toBeInTheDocument()
  })
})

/**
 * Subtasks, and the controls that go with them.
 *
 * What is on offer comes from the capability list, including the Backend's own
 * nesting limit — a fifth level in Todoist is a write Todoist would refuse, so
 * it is never offered here (ADR-0014).
 */
describe('nested subtasks', () => {
  const parent = { _id: 't1', title: 'Plant beds', done: false, order: 0 }
  const child = {
    _id: 't2',
    title: 'Buy pots',
    done: false,
    order: 0,
    parentTaskId: 't1',
  }

  test('draws a subtask under its parent, indented', () => {
    state.tasks = [child, parent]
    renderCard()

    const rows = screen.getAllByRole('checkbox')
    expect(rows).toHaveLength(2)
    // Parent first, whatever order the query returned them in.
    expect(
      screen.getAllByText(/Plant beds|Buy pots/).map((n) => n.textContent),
    ).toEqual(['Plant beds', 'Buy pots'])
  })

  test('adds a subtask under the task the control belongs to', async () => {
    state.tasks = [parent]
    renderCard()

    fireEvent.click(
      screen.getByRole('button', { name: /add a subtask to plant beds/i }),
    )
    fireEvent.change(screen.getByLabelText(/new subtask under plant beds/i), {
      target: { value: 'Buy pots' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: /^add task$/i })[1])

    await waitFor(() => {
      expect(state.calls['tasks:add']).toEqual([
        {
          listId: 'list_1',
          groupSlug: 'jansen-household',
          title: 'Buy pots',
          parentTaskId: 't1',
        },
      ])
    })
  })

  test('offers to promote a subtask, and nothing to promote on a parent', async () => {
    state.tasks = [parent, child]
    renderCard()

    expect(
      screen.queryByRole('button', {
        name: /move plant beds out of its parent/i,
      }),
    ).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: /move buy pots out of its parent/i }),
    )

    await waitFor(() => {
      expect(state.calls['tasks:reparent']).toEqual([
        { taskId: 't2', groupSlug: 'jansen-household', parentTaskId: null },
      ])
    })
  })

  test('stops offering subtasks at the Backend’s own limit', () => {
    state.backend = externalBackend({
      capabilities: { ...ALL, reorder: false, maxDepth: 2 },
    })
    state.tasks = [parent, child]
    renderCard()

    // The parent sits at depth 0, so a child of it would be level 2 — allowed.
    expect(
      screen.getByRole('button', { name: /add a subtask to plant beds/i }),
    ).toBeInTheDocument()
    // The child is already level 2; a subtask of it would be the third.
    expect(
      screen.queryByRole('button', { name: /add a subtask to buy pots/i }),
    ).toBeNull()
  })

  test('offers nothing at all on a Backend without subtasks', () => {
    state.backend = externalBackend({
      capabilities: { ...ALL, subtasks: false },
    })
    state.tasks = [parent, child]
    renderCard()

    expect(
      screen.queryByRole('button', { name: /add a subtask to plant beds/i }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: /out of its parent/i }),
    ).toBeNull()
  })

  test('a subtask on a Todoist list moves through the provider', async () => {
    state.backend = externalBackend({
      capabilities: { ...ALL, reorder: false, maxDepth: 4 },
    })
    state.tasks = [parent, child]
    renderCard()

    fireEvent.click(
      screen.getByRole('button', { name: /move buy pots out of its parent/i }),
    )

    await waitFor(() => {
      expect(state.calls['externalTasks:move']).toEqual([
        { taskId: 't2', groupSlug: 'jansen-household', parentTaskId: null },
      ])
    })
    expect(state.calls['tasks:reparent']).toBeUndefined()
  })
})
