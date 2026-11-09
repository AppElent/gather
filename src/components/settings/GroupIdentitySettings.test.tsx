import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { ConvexError } from 'convex/values'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { TEST_GROUP } from '../app/testing'
import type { ShellGroup } from '../app/useCurrentGroup'
import { GroupIdentitySettings } from './GroupIdentitySettings'

/**
 * Deleting a Group, from its own settings.
 *
 * Only an admin is offered it, and only the last Member can do it: the server
 * refuses otherwise, and nothing on the web removes another Member, so the
 * button says why it is off rather than asking a question it cannot honour.
 */

const ME = { userId: 'u_me', name: 'Alice', role: 'admin' }
const OTHER = { userId: 'u_bob', name: 'Bob', role: 'member' }

const members = vi.hoisted(() => ({ value: [] as unknown }))
const queried = vi.hoisted(() => ({ value: [] as Array<[string, unknown]> }))
const deleteError = vi.hoisted(() => ({ value: null as unknown }))
const calls = vi.hoisted(() => ({ value: [] as Array<[string, unknown]> }))
const navigated = vi.hoisted(() => ({ value: [] as unknown[] }))

vi.mock('convex/react', () => ({
  useQuery: (name: string, args: unknown) => {
    queried.value.push([name, args])
    if (args === 'skip') return undefined
    if (name === 'groups:members') return members.value
    if (name === 'groups:inviteCode') return 'ABC123'
    return undefined
  },
  useMutation: (name: string) => async (args: unknown) => {
    calls.value.push([name, args])
    if (name === 'groups:deleteGroup' && deleteError.value) {
      throw deleteError.value
    }
  },
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    groups: {
      members: 'groups:members',
      inviteCode: 'groups:inviteCode',
      renameGroup: 'groups:renameGroup',
      leaveGroup: 'groups:leaveGroup',
      deleteGroup: 'groups:deleteGroup',
      updateAppearance: 'groups:updateAppearance',
      generateImageUploadUrl: 'groups:generateImageUploadUrl',
    },
  },
}))

vi.mock('../photo/ImageUploadField', () => ({ ImageUploadField: () => null }))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => async (link: unknown) => {
    navigated.value.push(link)
  },
}))

beforeEach(() => {
  members.value = [ME]
  queried.value = []
  deleteError.value = null
  calls.value = []
  navigated.value = []
})

function renderCard(group: ShellGroup = TEST_GROUP) {
  renderWithI18n(<GroupIdentitySettings group={group} />)
}

const deleteButton = () =>
  screen.queryByRole('button', { name: 'Delete this group' })

describe('who is offered it', () => {
  test('not a Member who is not an admin, and their members are not read', () => {
    renderCard({ ...TEST_GROUP, role: 'member' })

    expect(deleteButton()).toBeNull()
    expect(queried.value).toContainEqual(['groups:members', 'skip'])
  })

  test('an admin who is the last one in it', () => {
    renderCard()

    expect(deleteButton()?.hasAttribute('disabled')).toBe(false)
    expect(screen.queryByText(/everyone else has left/i)).toBeNull()
  })

  test('an admin with others still in it sees it off, and why', () => {
    members.value = [ME, OTHER]
    renderCard()

    const button = deleteButton()
    expect(button?.hasAttribute('disabled')).toBe(true)
    expect(
      document.getElementById(button?.getAttribute('aria-describedby') ?? '')
        ?.textContent,
    ).toBe('Only possible once everyone else has left the group.')
  })
})

describe('deleting', () => {
  test('asks first, saying the content goes for good', () => {
    renderCard()
    fireEvent.click(deleteButton() as HTMLElement)

    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('Delete Jansen household?')
    expect(dialog.textContent).toContain('deleted for good')
    expect(calls.value).toEqual([])
  })

  test('confirming deletes the Group and goes where leaving goes', async () => {
    renderCard()
    fireEvent.click(deleteButton() as HTMLElement)
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete group',
      }),
    )

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(calls.value).toEqual([
      ['groups:deleteGroup', { groupId: TEST_GROUP._id }],
    ])
    expect(navigated.value).toEqual([
      expect.objectContaining({ to: '/groups' }),
    ])
  })

  test('a refusal stays on the dialog, in words', async () => {
    deleteError.value = new ConvexError(
      'Remove the other members before deleting this group',
    )
    renderCard()
    fireEvent.click(deleteButton() as HTMLElement)
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete group' }))

    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      'Remove the other members before deleting this group',
    )
    expect(navigated.value).toEqual([])
  })
})
