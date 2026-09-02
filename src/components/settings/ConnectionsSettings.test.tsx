import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { ConnectionsSettings } from './ConnectionsSettings'

/**
 * The panel that connects a Group to Notion or Todoist.
 *
 * A connection is Group-scoped content: the token belongs to the household that
 * authorised it. Two things follow, and both are here. The panel has to name
 * the Group it is acting on — "your whole group" is not something a person in
 * two households can act on safely — and every call it makes has to carry that
 * Group's slug, including the one that leaves the app entirely.
 */

const connections = vi.hoisted(() => ({ value: [] as unknown[] }))
const calls = vi.hoisted(() => ({ value: {} as Record<string, unknown[]> }))

vi.mock('convex/react', () => ({
  useQuery: () => connections.value,
  useMutation: (name: string) => async (args: unknown) => {
    calls.value[name] = [...(calls.value[name] ?? []), args]
  },
  useAction: (name: string) => async (args: unknown) => {
    calls.value[name] = [...(calls.value[name] ?? []), args]
    return 'https://api.notion.com/v1/oauth/authorize?state=x'
  },
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    integrations: {
      listConnections: 'integrations:listConnections',
      disconnect: 'integrations:disconnect',
      getAuthorizeUrl: 'integrations:getAuthorizeUrl',
    },
  },
}))

const NOTION = {
  _id: 'conn_1',
  provider: 'notion',
  accountLabel: 'Jansen workspace',
  connectedByName: 'Alice',
}

beforeEach(() => {
  connections.value = []
  calls.value = {}
  sessionStorage.clear()
  // Connecting ends in a real navigation, which jsdom cannot do; the panel's
  // side effect worth asserting happens just before it.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, origin: 'http://localhost:3000', href: '' },
  })
})

function renderPanel() {
  renderWithI18n(
    <ConnectionsSettings
      groupSlug="jansen-household"
      groupName="Jansen Household"
    />,
  )
}

describe('what the panel says', () => {
  test('names the Group it is acting on', () => {
    renderPanel()
    expect(
      screen.getByText(/connect an external app for/i).textContent,
    ).toContain('Jansen Household')
  })

  test('names the connected account and who connected it', () => {
    connections.value = [NOTION]
    renderPanel()
    expect(
      screen.getByText(/Jansen workspace — connected by Alice/),
    ).toBeDefined()
  })
})

describe('what the panel does', () => {
  test('disconnects from the Group in the address, not from wherever the connection is', async () => {
    connections.value = [NOTION]
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: /^disconnect$/i }))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: /^disconnect$/i,
      }),
    )

    await waitFor(() => {
      expect(calls.value['integrations:disconnect']).toEqual([
        { connectionId: 'conn_1', groupSlug: 'jansen-household' },
      ])
    })
  })

  /**
   * The question used to be a `window.confirm`, which an embedded frame may
   * suppress outright — the click then did nothing at all, silently, which is
   * exactly how the delete-a-list bug presented. It is the app's own dialog
   * now, so the asking is testable and cannot be taken away by the frame.
   */
  test('asks about this Group by name before disconnecting, and drops it on cancel', () => {
    connections.value = [NOTION]
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: /^disconnect$/i }))

    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('Jansen Household')

    fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(calls.value['integrations:disconnect']).toBeUndefined()
  })

  test('writes the Group down before leaving for the provider', async () => {
    renderPanel()

    fireEvent.click(screen.getAllByRole('button', { name: /connect/i })[0])

    // The callback comes back on a fresh page load and can know the Group only
    // from here.
    await waitFor(() => {
      expect(sessionStorage.getItem('gather.oauth.groupSlug')).toBe(
        'jansen-household',
      )
    })
    expect(sessionStorage.getItem('gather.oauth.returnTo')).toBe(
      '/group-settings',
    )
  })
})
