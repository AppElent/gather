import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const signIn = {
  status: null as string | null,
  password: vi.fn(),
  finalize: vi.fn(),
}
const { password: create, finalize } = signIn
vi.mock('@clerk/react', () => ({ useSignIn: () => ({ signIn }) }))

import { renderWithI18n } from '../i18n/testing'
import { TestLoginButton } from './TestLoginButton'

describe('TestLoginButton', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    signIn.status = null
    create.mockReset()
    finalize.mockReset()
  })

  it('renders nothing without a test instance + creds', () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'pk_live_x')
    const { container } = renderWithI18n(
      <TestLoginButton onSuccess={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing on a test instance when creds are absent', () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'pk_test_x')
    vi.stubEnv('VITE_TEST_USER_EMAIL', '')
    vi.stubEnv('VITE_TEST_USER_PASSWORD', '')
    const { container } = renderWithI18n(
      <TestLoginButton onSuccess={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('signs in with env creds when shown and clicked', async () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'pk_test_x')
    vi.stubEnv('VITE_TEST_USER_EMAIL', 'test@test.com')
    vi.stubEnv('VITE_TEST_USER_PASSWORD', 'appelent_test')
    create.mockImplementation(async () => {
      signIn.status = 'complete'
      return { error: null }
    })
    finalize.mockResolvedValue({ error: null })
    const onSuccess = vi.fn()

    renderWithI18n(<TestLoginButton onSuccess={onSuccess} />)
    screen.getByRole('button', { name: /test/i }).click()
    await vi.waitFor(() => expect(finalize).toHaveBeenCalled())
    expect(create).toHaveBeenCalledWith({
      identifier: 'test@test.com',
      password: 'appelent_test',
    })
    expect(onSuccess).toHaveBeenCalled()
  })
})
