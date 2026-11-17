import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

/** A Clerk Core 3 `signUp`: steps resolve to `{ error }`, state is read back. */
const signUp = {
  status: null as string | null,
  missingFields: [] as string[],
  unverifiedFields: [] as string[],
  emailAddress: null as string | null,
  password: vi.fn(),
  verifications: {
    sendEmailCode: vi.fn(),
    verifyEmailCode: vi.fn(),
    externalAccount: null as { status: string } | null,
  },
  finalize: vi.fn(),
}
const { password: create, finalize } = signUp
const { sendEmailCode: prepare, verifyEmailCode: attempt } =
  signUp.verifications
vi.mock('@clerk/react', () => ({
  useSignUp: () => ({ signUp }),
  // `SocialButtons` reads it; the default config lists no providers, so it draws nothing.
  useSignIn: () => ({ signIn: {} }),
  useAuth: () => ({ isLoaded: clerk.loaded }),
}))
const clerk = { loaded: true }

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
    signUp.verifications.externalAccount = null
    clerk.loaded = true
    for (const m of [create, prepare, attempt, finalize]) m.mockReset()
  })

  it('waits for Clerk before reading the attempt, then resumes a social sign-up', async () => {
    // Before load Clerk's placeholder sign-up reads `missing_requirements`.
    clerk.loaded = false
    signUp.status = 'missing_requirements'
    const view = renderForm()
    expect(screen.queryByText(/can't ask for yet/i)).toBeNull()
    clerk.loaded = true
    signUp.verifications.externalAccount = { status: 'verified' }
    signUp.unverifiedFields = ['email_address']
    signUp.emailAddress = 'a@b.com'
    prepare.mockImplementation(ok())
    view.rerender(
      <AuthConfigProvider>
        <SignUpForm onSuccess={vi.fn()} />
      </AuthConfigProvider>,
    )
    expect(await screen.findByLabelText(/verification code/i)).toBeDefined()
  })

  it('leaves an abandoned email sign-up alone on arrival', () => {
    signUp.status = 'missing_requirements'
    signUp.unverifiedFields = ['email_address']
    signUp.emailAddress = 'a@b.com'
    renderForm()
    expect(screen.getByLabelText('Email')).toBeDefined()
    expect(prepare).not.toHaveBeenCalled()
  })

  it('resumes a social sign-up that only needs its email verified', async () => {
    signUp.verifications.externalAccount = { status: 'verified' }
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
    signUp.verifications.externalAccount = { status: 'verified' }
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
