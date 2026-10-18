// @vitest-environment jsdom
import { ConvexError } from 'convex/values'
import { act } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { ACCOUNT_DELETED } from '../../../../convex/lib/sharing'
import { mount, settle } from '../testing/dom'
import { type Provisioning, useEnsureUser } from './useEnsureUser'

const backend = vi.hoisted(() => ({
  ensureUser: vi.fn<() => Promise<unknown>>(),
}))

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useMutation: () => backend.ensureUser,
}))

function renderHook() {
  const result = { current: undefined as unknown as Provisioning }
  function Probe() {
    result.current = useEnsureUser()
    return null
  }
  const view = mount(<Probe />)
  return { result, view }
}

describe('useEnsureUser', () => {
  afterEach(() => {
    backend.ensureUser.mockReset()
    document.body.innerHTML = ''
  })

  test('provisions once Convex is authenticated', async () => {
    backend.ensureUser.mockResolvedValue('user-id')
    const { result } = renderHook()
    await settle()
    expect(backend.ensureUser).toHaveBeenCalledOnce()
    expect(result.current.failed).toBe(false)
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
    expect(result.current.attempt).toBe(1)
  })

  test('does not report an account mid-deletion as a failure: that screen is already signing out', async () => {
    backend.ensureUser.mockRejectedValue(new ConvexError(ACCOUNT_DELETED))
    const { result } = renderHook()
    await settle()
    expect(result.current.failed).toBe(false)
  })
})
