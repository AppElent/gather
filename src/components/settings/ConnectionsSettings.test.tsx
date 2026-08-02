import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
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
  window.confirm = () => true
})

function renderPanel() {
  render(
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

    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }))

    await waitFor(() => {
      expect(calls.value['integrations:disconnect']).toEqual([
        { connectionId: 'conn_1', groupSlug: 'jansen-household' },
      ])
    })
  })

  test('asks about this Group by name before disconnecting', () => {
    connections.value = [NOTION]
    let asked = ''
    window.confirm = (message?: string) => {
      asked = message ?? ''
      return false
    }
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }))

    expect(asked).toContain('Jansen Household')
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
      '/g/jansen-household/settings',
    )
  })
})
