import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

/** A Clerk Core 3 `signUp`: steps resolve to `{ error }`, state is read back. */
const signUp = {
  status: null as string | null,
  password: vi.fn(),
  verifications: { sendEmailCode: vi.fn(), verifyEmailCode: vi.fn() },
  finalize: vi.fn(),
}
const { password: create, finalize } = signUp
const { sendEmailCode: prepare, verifyEmailCode: attempt } =
  signUp.verifications
vi.mock('@clerk/react', () => ({ useSignUp: () => ({ signUp }) }))

const ok = (status?: string) => async () => {
  if (status) signUp.status = status
  return { error: null }
}

import { renderWithI18n } from '../i18n/testing'
import { AuthConfigProvider } from './AuthConfigProvider'
import { SignUpForm } from './SignUpForm'

function renderForm(onSuccess = vi.fn()) {
  return renderWithI18n(
    <AuthConfigProvider>
      <SignUpForm onSuccess={onSuccess} />
    </AuthConfigProvider>,
  )
}

describe('SignUpForm', () => {
  afterEach(() => {
    cleanup()
    signUp.status = null
    for (const m of [create, prepare, attempt, finalize]) m.mockReset()
  })

  it('moves to the verification step after creating the account', async () => {
    create.mockImplementation(ok('missing_requirements'))
    prepare.mockImplementation(ok())
    renderForm()
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'a@b.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'pw12345!' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByLabelText(/verification code/i)).toBeDefined()
    expect(create).toHaveBeenCalledWith({
      emailAddress: 'a@b.com',
      password: 'pw12345!',
    })
    expect(prepare).toHaveBeenCalledTimes(1)
  })

  it('verifies the code and completes sign-up', async () => {
    create.mockImplementation(ok('missing_requirements'))
    prepare.mockImplementation(ok())
    attempt.mockImplementation(ok('complete'))
    finalize.mockImplementation(ok())
    const onSuccess = vi.fn()
    renderForm(onSuccess)
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'a@b.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'pw12345!' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    const code = await screen.findByLabelText(/verification code/i)
    fireEvent.change(code, { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: /verify/i }))
    await vi.waitFor(() => expect(finalize).toHaveBeenCalled())
    expect(attempt).toHaveBeenCalledWith({ code: '123456' })
    expect(onSuccess).toHaveBeenCalled()
  })
})
