import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

/** A Clerk Core 3 `signIn`: steps resolve to `{ error }`, state is read back. */
const signIn = {
  status: null as string | null,
  create: vi.fn(),
  resetPasswordEmailCode: {
    sendCode: vi.fn(),
    verifyCode: vi.fn(),
    submitPassword: vi.fn(),
  },
  finalize: vi.fn(),
}
const { create, finalize } = signIn
const { sendCode, verifyCode, submitPassword } = signIn.resetPasswordEmailCode
vi.mock('@clerk/react', () => ({ useSignIn: () => ({ signIn }) }))

/** A step that succeeds and leaves the attempt at `status`. */
const ok = (status?: string) => async () => {
  if (status) signIn.status = status
  return { error: null }
}

import { renderWithI18n } from '../i18n/testing'
import { AuthConfigProvider } from './AuthConfigProvider'
import { ForgotPasswordForm } from './ForgotPasswordForm'

function renderForm(onSuccess = vi.fn()) {
  return renderWithI18n(
    <AuthConfigProvider>
      <ForgotPasswordForm onSuccess={onSuccess} />
    </AuthConfigProvider>,
  )
}

async function reachResetStep(onSuccess = vi.fn()) {
  create.mockImplementation(ok('needs_first_factor'))
  sendCode.mockImplementation(ok())
  renderForm(onSuccess)
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'a@b.com' },
  })
  fireEvent.click(screen.getByRole('button', { name: /send code/i }))
  fireEvent.change(await screen.findByLabelText(/code/i), {
    target: { value: '123456' },
  })
  return onSuccess
}

function submitPasswordAs(value: string) {
  fireEvent.change(screen.getByLabelText(/new password/i), {
    target: { value },
  })
  fireEvent.click(screen.getByRole('button', { name: /reset password/i }))
}

describe('ForgotPasswordForm', () => {
  afterEach(() => {
    cleanup()
    signIn.status = null
    for (const m of [create, sendCode, verifyCode, submitPassword, finalize])
      m.mockReset()
  })

  it('requests a reset code then sets a new password', async () => {
    verifyCode.mockImplementation(ok('needs_new_password'))
    submitPassword.mockImplementation(ok('complete'))
    finalize.mockImplementation(ok())
    const onSuccess = await reachResetStep()
    expect(create).toHaveBeenCalledWith({ identifier: 'a@b.com' })
    expect(sendCode).toHaveBeenCalledTimes(1)

    submitPasswordAs('newpw123!')
    await vi.waitFor(() => expect(finalize).toHaveBeenCalled())
    expect(verifyCode).toHaveBeenCalledWith({ code: '123456' })
    expect(submitPassword).toHaveBeenCalledWith({ password: 'newpw123!' })
    expect(onSuccess).toHaveBeenCalled()
  })

  it('retries only the password after it is rejected', async () => {
    verifyCode.mockImplementation(ok('needs_new_password'))
    submitPassword
      .mockResolvedValueOnce({
        error: { errors: [{ message: 'Password too weak.' }] },
      })
      .mockImplementation(ok('complete'))
    finalize.mockImplementation(ok())
    const onSuccess = await reachResetStep()

    submitPasswordAs('weak')
    expect(await screen.findByText('Password too weak.')).toBeDefined()

    submitPasswordAs('newpw123!')
    await vi.waitFor(() => expect(finalize).toHaveBeenCalled())
    expect(verifyCode).toHaveBeenCalledTimes(1)
    expect(submitPassword).toHaveBeenLastCalledWith({ password: 'newpw123!' })
    expect(onSuccess).toHaveBeenCalled()
  })
})
