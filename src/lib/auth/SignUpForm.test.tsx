import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

/** A Clerk Core 3 `signUp`: steps resolve to `{ error }`, state is read back. */
const signUp = {
  status: null as string | null,
  missingFields: [] as string[],
  unverifiedFields: [] as string[],
  emailAddress: null as string | null,
  password: vi.fn(),
  verifications: { sendEmailCode: vi.fn(), verifyEmailCode: vi.fn() },
  finalize: vi.fn(),
}
const { password: create, finalize } = signUp
const { sendEmailCode: prepare, verifyEmailCode: attempt } =
  signUp.verifications
vi.mock('@clerk/react', () => ({
  useSignUp: () => ({ signUp }),
  // `SocialButtons` reads it; the default config lists no providers, so it draws nothing.
  useSignIn: () => ({ signIn: {} }),
}))

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
    signUp.missingFields = []
    signUp.unverifiedFields = []
    signUp.emailAddress = null
    for (const m of [create, prepare, attempt, finalize]) m.mockReset()
  })

  it('resumes a social sign-up that only needs its email verified', async () => {
    signUp.status = 'missing_requirements'
    signUp.unverifiedFields = ['email_address']
    signUp.emailAddress = 'a@b.com'
    prepare.mockImplementation(ok())
    renderForm()
    expect(await screen.findByLabelText(/verification code/i)).toBeDefined()
    expect(screen.getByText(/a@b\.com/)).toBeDefined()
    expect(prepare).toHaveBeenCalledTimes(1)
  })

  it('says so when a social sign-up needs a field the form cannot ask for', async () => {
    signUp.status = 'missing_requirements'
    signUp.missingFields = ['username']
    renderForm()
    expect(await screen.findByText(/can't ask for yet/i)).toBeDefined()
    expect(prepare).not.toHaveBeenCalled()
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
