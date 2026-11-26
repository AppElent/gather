// @vitest-environment jsdom
import { ACCOUNT_DELETED } from '@gather/core/refusals'
import { ConvexError } from 'convex/values'
import { act } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { mount, settle } from '../testing/dom'
import { type Provisioning, useEnsureUser } from './useEnsureUser'

const backend = vi.hoisted(() => ({
  ensureUser: vi.fn<(args: { name?: string }) => Promise<unknown>>(),
}))

const clerk = vi.hoisted(() => ({
  user: { fullName: 'Sanne Bos', firstName: 'Sanne' } as {
    fullName: string | null
    firstName: string | null
  },
}))

vi.mock('@clerk/expo', () => ({
  useUser: () => ({ user: clerk.user }),
}))

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useMutation: () => backend.ensureUser,
}))

const result = { current: undefined as unknown as Provisioning }

function Probe() {
  result.current = useEnsureUser()
  return null
}

function renderHook() {
  const view = mount(<Probe />)
  return { result, view }
}

describe('useEnsureUser', () => {
  afterEach(() => {
    backend.ensureUser.mockReset()
    clerk.user = { fullName: 'Sanne Bos', firstName: 'Sanne' }
    document.body.innerHTML = ''
  })

  test('provisions once Convex is authenticated', async () => {
    backend.ensureUser.mockResolvedValue('user-id')
    const { result } = renderHook()
    await settle()
    expect(backend.ensureUser).toHaveBeenCalledOnce()
    expect(result.current.failed).toBe(false)
  })

  test('sends the name Clerk has for the account (APP-676)', async () => {
    backend.ensureUser.mockResolvedValue('user-id')
    renderHook()
    await settle()
    expect(backend.ensureUser).toHaveBeenCalledWith({ name: 'Sanne Bos' })
  })

  test('sends the new name again when the name in Clerk changes (APP-678)', async () => {
    backend.ensureUser.mockResolvedValue('user-id')
    const { view } = renderHook()
    await settle()
    expect(backend.ensureUser).toHaveBeenCalledOnce()

    clerk.user = { fullName: 'Sanne de Boer', firstName: 'Sanne' }
    view.rerender(<Probe />)
    await settle()
    expect(backend.ensureUser).toHaveBeenCalledTimes(2)
    expect(backend.ensureUser).toHaveBeenLastCalledWith({ name: 'Sanne de Boer' })
  })

  test('reports a refused provisioning instead of swallowing it, and retry runs it again', async () => {
    backend.ensureUser.mockRejectedValueOnce(new Error('Server Error'))
    const { result } = renderHook()
    await settle()
    expect(result.current.failed).toBe(true)

    backend.ensureUser.mockResolvedValue('user-id')
    act(() => result.current.retry())
    expect(result.current.failed).toBe(false)
    await settle()
    expect(backend.ensureUser).toHaveBeenCalledTimes(2)
    expect(result.current.failed).toBe(false)
  })

  test('reports an account mid-deletion as deleted, not as a failure to retry', async () => {
    backend.ensureUser.mockRejectedValue(new ConvexError(ACCOUNT_DELETED))
    const { result } = renderHook()
    await settle()
    expect(result.current.failed).toBe(false)
    expect(result.current.deleted).toBe(true)
  })

  test('a later attempt that succeeds clears deleted', async () => {
    backend.ensureUser.mockRejectedValue(new ConvexError(ACCOUNT_DELETED))
    const { result } = renderHook()
    await settle()
    expect(result.current.deleted).toBe(true)

    backend.ensureUser.mockResolvedValue('user-id')
    act(() => result.current.retry())
    await settle()
    expect(result.current.deleted).toBe(false)
  })
})
