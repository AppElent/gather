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
 * Only the last Member can do it: the server refuses otherwise, and nothing on
 * the web removes another Member, so an admin's button says why it is off
 * rather than asking a question it cannot honour. The last Member is offered
 * it in place of Leave (`groups.leaveStatus`, APP-362).
 */

const LAST_MEMBER = { leave: 'last-member', canDelete: true }
const OTHERS_REMAIN = { leave: 'allowed', canDelete: false }

const exits = vi.hoisted(() => ({ value: undefined as unknown }))
const queried = vi.hoisted(() => ({ value: [] as Array<[string, unknown]> }))
const deleteError = vi.hoisted(() => ({ value: null as unknown }))
const calls = vi.hoisted(() => ({ value: [] as Array<[string, unknown]> }))
const navigated = vi.hoisted(() => ({ value: [] as unknown[] }))

vi.mock('convex/react', () => ({
  useQuery: (name: string, args: unknown) => {
    queried.value.push([name, args])
    if (args === 'skip') return undefined
    if (name === 'groups:leaveStatus') return exits.value
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
      leaveStatus: 'groups:leaveStatus',
      inviteCode: 'groups:inviteCode',
      renameGroup: 'groups:renameGroup',
      setTimeZone: 'groups:setTimeZone',
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
  exits.value = LAST_MEMBER
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
const leaveButton = () =>
  screen.queryByRole('button', { name: 'Leave this group' })
const noteFor = (button: HTMLElement | null) =>
  document.getElementById(button?.getAttribute('aria-describedby') ?? '')
    ?.textContent

describe('the time zone', () => {
  const zone = () => screen.getByLabelText('Time zone') as unknown as HTMLSelectElement

  test('an admin picks one, uses the device’s, or clears it', async () => {
    renderCard({ ...TEST_GROUP, timeZone: 'Asia/Tokyo' })
    expect(zone().value).toBe('Asia/Tokyo')
    fireEvent.change(zone(), { target: { value: '' } })
    await waitFor(() => expect(zone().disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: /Use this device/ }))
    await waitFor(() =>
      expect(calls.value.map(([, args]) => args)).toEqual([
        { groupId: TEST_GROUP._id, timeZone: null },
        {
          groupId: TEST_GROUP._id,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      ]),
    )
  })

  test('a plain member only reads it, and without one sees the device’s', () => {
    renderCard({ ...TEST_GROUP, role: 'member' })
    expect(zone().disabled).toBe(true)
    expect(zone().selectedOptions[0].textContent).toContain(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    )
    expect(screen.queryByRole('button', { name: /Use this device/ })).toBeNull()
  })
})

describe('who is offered it', () => {
  test('not a Member who is not an admin while others remain; they may leave', () => {
    exits.value = OTHERS_REMAIN
    renderCard({ ...TEST_GROUP, role: 'member' })

    expect(deleteButton()).toBeNull()
    expect(leaveButton()).not.toBeNull()
    expect(queried.value).toContainEqual([
      'groups:leaveStatus',
      { slug: TEST_GROUP.slug },
    ])
  })

  test('the last Member, in place of Leave, and why', () => {
    renderCard()

    const button = deleteButton()
    expect(button?.hasAttribute('disabled')).toBe(false)
    expect(leaveButton()).toBeNull()
    expect(noteFor(button)).toBe(
      'You are the last member, so the group cannot be left. Delete it instead.',
    )
  })

  test('the last Member even when they are not an admin', () => {
    renderCard({ ...TEST_GROUP, role: 'member' })

    expect(deleteButton()?.hasAttribute('disabled')).toBe(false)
    expect(leaveButton()).toBeNull()
  })

  test('an admin with others still in it sees it off, and why', () => {
    exits.value = OTHERS_REMAIN
    renderCard()

    const button = deleteButton()
    expect(button?.hasAttribute('disabled')).toBe(true)
    expect(noteFor(button)).toBe(
      'Only possible once everyone else has left the group.',
    )
    expect(leaveButton()).not.toBeNull()
  })

  test('nobody, before the server has said', () => {
    exits.value = undefined
    renderCard()

    expect(deleteButton()?.hasAttribute('disabled')).toBe(true)
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
